import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/テスト結果UT_25_マスタ分類CSVダウンロード",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const VIEWER = {
  id: "viwTest",
  role: "VIEWER",
  password: process.env.SEED_VIEWER_PASSWORD ?? "test@123",
};

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

test.describe.serial("マスタ分類CSVダウンロード（MST-06起点）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const before = await prisma.masterCategory.count();
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify({ count: before }, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.masterCategory.count();
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify({ count: after }, null, 2));
    await prisma.$disconnect();
  });

  test("TC-001 全件CSVダウンロード（VIEWERロール）", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/master/categories");

    const totalText = await page.getByText(/全\d+件（1 \//).textContent();
    const total = Number(totalText?.match(/全(\d+)件/)?.[1]);
    expect(total).toBeGreaterThan(0);

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "CSVダウンロード" }).click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^master_categories_\d{14}\.csv$/);
    const savedPath = evidence("001_ダウンロードしたCSV_全件.csv");
    await download.saveAs(savedPath);

    const { bom, lines } = readCsvLines(savedPath);
    expect(bom).toBe(true);
    expect(lines[0]).toBe(
      "マスタ分類コード,マスタ分類名,登録マスタ件数,登録日時,登録者,最終更新日時,最終更新者",
    );
    expect(lines.length - 1).toBe(total);

    await page.screenshot({ path: evidence("001_CSVダウンロード全件_VIEWER.png"), fullPage: true });
  });

  test("TC-002 未ログインでURLを直接開く", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto("/api/master/categories/exports/csv");
    expect(response?.status()).toBe(401);
    const body = await response?.json();
    expect(body?.error?.code).toBe("UNAUTHORIZED");
    await page.screenshot({ path: evidence("002_未ログインアクセス.png"), fullPage: true });

    await context.close();
  });
});
