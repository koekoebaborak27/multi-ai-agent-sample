import fs from "node:fs";
import path from "node:path";
import { test, expect, type Browser, type Page } from "@playwright/test";

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/dashboard/テスト結果UT_10_トップ画面",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN_LOGIN_ID = process.env.SEED_ADMIN_LOGIN_ID ?? "admin";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
const OPERATOR_LOGIN_ID = process.env.SEED_OPERATOR_LOGIN_ID ?? "opeTest";
const OPERATOR_PASSWORD = process.env.SEED_OPERATOR_PASSWORD ?? "test@123";
const VIEWER_LOGIN_ID = process.env.SEED_VIEWER_LOGIN_ID ?? "viwTest";
const VIEWER_PASSWORD = process.env.SEED_VIEWER_PASSWORD ?? "test@123";

async function login(page: Page, userId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(userId);
  await page.getByRole("textbox", { name: "パスワード" }).fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe("トップ画面（ダッシュボード）", () => {
  test.beforeAll(() => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test("TC-001 トップ画面の表示構成", async ({ page }) => {
    await login(page, ADMIN_LOGIN_ID, ADMIN_PASSWORD);
    await expect(page.getByRole("heading", { name: "トップ" })).toBeVisible();
    await expect(page.getByText("お知らせ", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("001_トップ画面表示.png"), fullPage: true });
  });

  test("TC-002 未ログインでのアクセス制御", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("002_未ログインリダイレクト.png"), fullPage: true });
  });

  test("TC-003 全ロールでの閲覧", async ({ browser }) => {
    // 3ロール分のログインを直列で行うため、既定の30秒では足りないことがある。
    test.setTimeout(90000);
    // 同じページでログインし直すと、既にログイン済み状態で/loginを開いた扱いになり
    // フォームが出ないため、ロールごとに独立したセッション（コンテキスト）を使う。
    for (const [roleLabel, userId, password] of [
      ["ADMIN", ADMIN_LOGIN_ID, ADMIN_PASSWORD],
      ["OPERATOR", OPERATOR_LOGIN_ID, OPERATOR_PASSWORD],
      ["VIEWER", VIEWER_LOGIN_ID, VIEWER_PASSWORD],
    ] as const) {
      const context = await (browser as Browser).newContext();
      const page = await context.newPage();
      await login(page, userId, password);
      await expect(page.getByRole("heading", { name: "トップ" })).toBeVisible();
      await expect(page.getByText("お知らせ", { exact: true })).toBeVisible();
      await page.screenshot({
        path: evidence(`003_閲覧権限_${roleLabel}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });
});
