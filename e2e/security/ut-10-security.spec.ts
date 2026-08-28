import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/security/テスト結果UT_10_セキュリティ横断テスト",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
};

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

const XSS_PAYLOAD = "<script>alert(1)</script>";
const SQLI_PAYLOAD = "' OR '1'='1";

const NEWS_TITLE = "E2E-SECURITY-XSS-NEWS";
const MASTER_CODE = "XSSTST01";
const PARTY_NAME = XSS_PAYLOAD;

test.describe.serial("セキュリティ横断テスト", () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    await prisma.news.deleteMany({ where: { title: NEWS_TITLE } });
    await prisma.master.deleteMany({ where: { code: MASTER_CODE } });
    await prisma.party.deleteMany({ where: { name: PARTY_NAME } });
    await prisma.$disconnect();
  });

  test("TC-001 お知らせ本文へのXSS注入", async ({ page }) => {
    let dialogFired = false;
    page.on("dialog", async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await login(page, ADMIN);
    await page.goto("/news");
    await page.getByRole("button", { name: "新規登録" }).click();
    await page.getByLabel("タイトル", { exact: true }).fill(NEWS_TITLE);
    // カテゴリをINCIDENTにする（トップ画面はカテゴリ昇順で並ぶため、確実に先頭付近に表示させるため）
    await page.getByRole("dialog").getByLabel("カテゴリ", { exact: true }).selectOption("INCIDENT");
    await page.getByLabel("本文").fill(XSS_PAYLOAD);
    await page.screenshot({ path: evidence("001_お知らせXSS入力.png"), fullPage: true });
    await page.getByRole("button", { name: "確認する" }).click();

    // 確認画面は入力値をそのままテキストとして表示する（news-confirmation.tsx）。
    // ここでスクリプトが実行されず文字列のまま表示されることを確認する。
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await page.screenshot({ path: evidence("001_お知らせXSS確認画面表示.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("お知らせを登録しました")).toBeVisible();

    // トップ画面の公開お知らせ表示（NewsItem）でも、本文がスクリプトとして実行されず
    // テキストとして表示されることを確認する。
    await page.goto("/");
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await page.screenshot({ path: evidence("001_お知らせXSSエスケープ表示.png"), fullPage: true });

    expect(dialogFired).toBe(false);
    const created = await prisma.news.findFirstOrThrow({ where: { title: NEWS_TITLE } });
    expect(created.body).toBe(XSS_PAYLOAD);
  });

  test("TC-002 マスタ内容欄へのXSS注入", async ({ page }) => {
    let dialogFired = false;
    page.on("dialog", async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await login(page, ADMIN);
    await page.goto("/master/new");
    await page.getByRole("combobox", { name: "マスタ分類" }).click();
    await page.getByRole("option").first().click();
    await page.getByLabel("マスタコード").fill(MASTER_CODE);
    await page.getByLabel("マスタ内容").fill(XSS_PAYLOAD);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/master\/\d+\?created=1/);
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await page.screenshot({ path: evidence("002_マスタXSS詳細表示.png"), fullPage: true });

    await page.goto(`/master?keyword=${encodeURIComponent(MASTER_CODE)}`);
    await expect(page.getByText(XSS_PAYLOAD)).toBeVisible();
    await page.screenshot({ path: evidence("002_マスタXSSエスケープ表示.png"), fullPage: true });

    expect(dialogFired).toBe(false);
    const created = await prisma.master.findFirstOrThrow({ where: { code: MASTER_CODE } });
    expect(created.content).toBe(XSS_PAYLOAD);
  });

  test("TC-003 契約先名称欄へのXSS注入", async ({ page }) => {
    let dialogFired = false;
    page.on("dialog", async (dialog) => {
      dialogFired = true;
      await dialog.dismiss();
    });

    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill(PARTY_NAME);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/parties\/[^/]+\?created=1/);
    await expect(page.getByText(XSS_PAYLOAD).first()).toBeVisible();
    await page.screenshot({ path: evidence("003_契約先XSS詳細表示.png"), fullPage: true });

    await page.goto("/parties");
    await page.getByLabel("名称", { exact: true }).fill("alert(1)");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: XSS_PAYLOAD })).toBeVisible();
    await page.screenshot({ path: evidence("003_契約先XSSエスケープ表示.png"), fullPage: true });

    expect(dialogFired).toBe(false);
    const created = await prisma.party.findFirstOrThrow({ where: { name: PARTY_NAME } });
    expect(created.name).toBe(PARTY_NAME);
  });

  test("TC-004 マスタ検索へのSQLインジェクション風入力", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");
    await page.getByLabel("マスタ文字列").fill(SQLI_PAYLOAD);
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByText("該当するマスタがありません")).toBeVisible();
    await page.screenshot({ path: evidence("004_マスタ検索SQLi風入力.png"), fullPage: true });
  });

  test("TC-005 お知らせ検索（開始日時ソート時）へのSQLインジェクション風入力", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/news");
    await page.getByLabel("文言").fill(SQLI_PAYLOAD);
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByText("該当するお知らせがありません")).toBeVisible();
    await page.screenshot({ path: evidence("005_お知らせ検索SQLi風入力.png"), fullPage: true });
  });

  test("TC-006 ログイン画面のレスポンスヘッダー確認", async ({ page }) => {
    const response = await page.goto("/login");
    const headers = response?.headers() ?? {};
    fs.writeFileSync(evidence("006_loginヘッダー.txt"), JSON.stringify(headers, null, 2));

    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["strict-transport-security"]).toContain("max-age=63072000");
    expect(headers["permissions-policy"]).toContain("camera=()");
  });

  test("TC-007 トップ画面・マスタ一覧のレスポンスヘッダー確認", async ({ page }) => {
    await login(page, ADMIN);

    const topResponse = await page.goto("/");
    const topHeaders = topResponse?.headers() ?? {};
    fs.writeFileSync(evidence("007_topヘッダー.txt"), JSON.stringify(topHeaders, null, 2));
    expect(topHeaders["x-frame-options"]).toBe("DENY");
    expect(topHeaders["strict-transport-security"]).toContain("max-age=63072000");

    const masterResponse = await page.goto("/master");
    const masterHeaders = masterResponse?.headers() ?? {};
    fs.writeFileSync(evidence("007_masterヘッダー.txt"), JSON.stringify(masterHeaders, null, 2));
    expect(masterHeaders["x-frame-options"]).toBe("DENY");
    expect(masterHeaders["strict-transport-security"]).toContain("max-age=63072000");
  });
});
