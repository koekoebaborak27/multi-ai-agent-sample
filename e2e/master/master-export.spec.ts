import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_15_マスタCSVダウンロード",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const VIEWER = {
  id: "viwTest",
  role: "VIEWER",
  password: process.env.SEED_VIEWER_PASSWORD ?? "test@123",
};

const CATEGORY_NAME = "CSV確認分類";

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

// ダウンロードされたCSVを読み、BOM付き・CRLF区切りの行配列にする（先頭行はヘッダー）
function readCsvLines(filePath: string): { bom: boolean; lines: string[] } {
  const buffer = fs.readFileSync(filePath);
  const bom = buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf;
  const text = buffer.toString("utf-8").replace(/^﻿/, "");
  const lines = text.split("\r\n").filter((line) => line.length > 0);
  return { bom, lines };
}

test.describe.serial("マスタCSVダウンロード（MST-01起点）", () => {
  let categoryId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const before = await prisma.masterCategory.findMany({ where: { name: CATEGORY_NAME } });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));

    const category = await prisma.masterCategory.create({ data: { name: CATEGORY_NAME } });
    categoryId = category.id;
    await prisma.master.createMany({
      data: [
        { categoryId, code: "AB01", content: "AB検索確認用マスタ" },
        { categoryId, code: "XX01", content: "対象外内容1" },
        { categoryId, code: "XX02", content: "対象外内容2" },
      ],
    });
  });

  test.afterAll(async () => {
    await prisma.master.deleteMany({ where: { categoryId } });
    await prisma.masterCategory.delete({ where: { id: categoryId } });

    const after = await prisma.masterCategory.findMany({ where: { name: CATEGORY_NAME } });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));
    await prisma.$disconnect();
  });

  test("TC-001 全件CSVダウンロード（VIEWERロール）", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/master?categoryId=all");

    const totalText = await page.getByText(/検索結果 全\d+件/).textContent();
    const total = Number(totalText?.match(/全(\d+)件/)?.[1]);
    expect(total).toBeGreaterThan(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSVダウンロード" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^master_\d{14}\.csv$/);
    const savedPath = evidence("001_ダウンロードしたCSV_全件.csv");
    await download.saveAs(savedPath);

    const { bom, lines } = readCsvLines(savedPath);
    expect(bom).toBe(true);
    expect(lines[0]).toBe(
      "マスタ分類コード,マスタ分類名,マスタID,マスタコード,マスタ内容,登録日時,登録者,最終更新日時,最終更新者",
    );
    expect(lines.length - 1).toBe(total);

    await page.screenshot({ path: evidence("001_CSVダウンロード全件_VIEWER.png"), fullPage: true });
  });

  test("TC-002 検索条件を指定したCSVダウンロード", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto(`/master?categoryId=${categoryId}&keyword=AB`);

    await expect(page.getByText("検索結果 全1件（1 / 1ページ）")).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSVダウンロード" }).click();
    const download = await downloadPromise;

    const savedPath = evidence("002_ダウンロードしたCSV_検索条件指定.csv");
    await download.saveAs(savedPath);

    const { lines } = readCsvLines(savedPath);
    expect(lines.length).toBe(2); // ヘッダー + AB01の1行
    expect(lines[1]).toContain("AB01");
    expect(lines[1]).toContain("AB検索確認用マスタ");
    for (const line of lines.slice(1)) {
      expect(line).not.toContain("XX01");
      expect(line).not.toContain("XX02");
    }

    await page.screenshot({
      path: evidence("002_CSVダウンロード検索条件指定.png"),
      fullPage: true,
    });
  });

  test("TC-003 未ログインでURLを直接開く", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto("/api/master/exports/csv");
    expect(response?.status()).toBe(401);
    const body = await response?.json();
    expect(body?.error?.code).toBe("UNAUTHORIZED");
    await page.screenshot({ path: evidence("003_未ログインアクセス.png"), fullPage: true });

    await context.close();
  });
});
