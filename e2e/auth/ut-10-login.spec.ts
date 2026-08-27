import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/shared/security/password";
import { env } from "../../src/shared/config/env";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/auth/テスト結果UT_10_ログイン画面",
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

const TEST_PASSWORD = "Test@1234";

const LOCKED_USER_ID = "e2eLoginLocked";
const MUST_CHANGE_USER_ID = "e2eLoginMustChange";
const ATTEMPTS_USER_ID = "e2eLoginAttempts";
const LOCKGEN_USER_ID = "e2eLoginLockGen";
const BOUNDARY_ID = "e2eLoginBoundary" + "X".repeat(64 - "e2eLoginBoundary".length);
const ALL_USER_IDS = [
  LOCKED_USER_ID,
  MUST_CHANGE_USER_ID,
  ATTEMPTS_USER_ID,
  LOCKGEN_USER_ID,
  BOUNDARY_ID,
];

async function fillLoginForm(page: Page, userId: string, password: string) {
  await page.getByLabel("ユーザーID").fill(userId);
  await page.getByRole("textbox", { name: "パスワード" }).fill(password);
}

// HTML標準のrequired属性が先に画面をせき止めてしまい、サーバー側の入力チェックまで
// 届かないため、未入力系のテストケースではこの属性を外してから送信する。
async function removeRequired(page: Page, id: string) {
  await page.locator(`#${id}`).evaluate((el) => el.removeAttribute("required"));
}

test.describe.serial("ログイン画面（LGN-01）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const passwordHash = await hashPassword(TEST_PASSWORD);

    await prisma.user.create({
      data: {
        id: LOCKED_USER_ID,
        role: "VIEWER",
        passwordHash,
        lockedAt: new Date(),
        failedAttempts: env.MAX_ATTEMPTS,
      },
    });
    await prisma.user.create({
      data: { id: MUST_CHANGE_USER_ID, role: "VIEWER", passwordHash, mustChangePassword: true },
    });
    await prisma.user.create({
      data: { id: ATTEMPTS_USER_ID, role: "VIEWER", passwordHash, failedAttempts: 0 },
    });
    await prisma.user.create({
      data: {
        id: LOCKGEN_USER_ID,
        role: "VIEWER",
        passwordHash,
        failedAttempts: env.MAX_ATTEMPTS - 2,
      },
    });
    await prisma.user.create({ data: { id: BOUNDARY_ID, role: "VIEWER", passwordHash } });

    const before = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, failedAttempts: true, lockedAt: true, mustChangePassword: true },
    });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, failedAttempts: true, lockedAt: true, mustChangePassword: true },
    });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));

    await prisma.user.deleteMany({ where: { id: { in: ALL_USER_IDS } } });
    await prisma.$disconnect();
  });

  test("TC-001 ID・パスワードでのログイン成功", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_LOGIN_ID, ADMIN_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("001_ログイン成功.png"), fullPage: true });
  });

  test("TC-002 Microsoftログインボタンの表示切替（ローカルはEntra未設定のため非表示側のみ確認）", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: "Microsoft Entra ID でログイン" })).toHaveCount(
      0,
    );
    await expect(page.getByLabel("ユーザーID")).toBeVisible();
    await page.screenshot({ path: evidence("002_Entraボタン非表示.png"), fullPage: true });
  });

  test("TC-003 パスワード再設定直後のメッセージ表示", async ({ page }) => {
    await page.goto("/login?message=password-reset");
    await expect(
      page.getByText("パスワードを変更しました。新しいパスワードでログインしてください。"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("003_再設定直後メッセージ.png"), fullPage: true });
  });

  test("TC-004 ログイン済みで/loginを開くとトップ画面へリダイレクト", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, ADMIN_LOGIN_ID, ADMIN_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.goto("/login");
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("004_ログイン済みリダイレクト.png"), fullPage: true });
  });

  test("TC-005 ユーザーID未入力", async ({ page }) => {
    await page.goto("/login");
    await removeRequired(page, "userId");
    await page.getByRole("textbox", { name: "パスワード" }).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByText("ユーザーIDを入力してください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("005_ID未入力.png"), fullPage: true });
  });

  test("TC-006 パスワード未入力", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("ユーザーID").fill(ATTEMPTS_USER_ID);
    await removeRequired(page, "password");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page.getByText("パスワードを入力してください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("006_パスワード未入力.png"), fullPage: true });
  });

  test("TC-007 ユーザーID64文字ちょうどでのログイン成功", async ({ page }) => {
    expect(BOUNDARY_ID.length).toBe(64);
    await page.goto("/login");
    await fillLoginForm(page, BOUNDARY_ID, TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("007_ID64文字境界.png"), fullPage: true });
  });

  test("TC-008 ユーザーIDまたはパスワードの誤り", async ({ page }) => {
    // (a) 存在しないユーザーID
    await page.goto("/login");
    await fillLoginForm(page, "e2eLoginNotExist", "wrongpass1");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("ユーザーIDまたはパスワードが正しくありません", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("008_ID誤り.png"), fullPage: true });
    await page.waitForLoadState("networkidle");

    // (b) 正しいユーザーIDに誤ったパスワード。あわせてfailedAttemptsの増加も確認する。
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ATTEMPTS_USER_ID } });
    await page.goto("/login");
    await fillLoginForm(page, ATTEMPTS_USER_ID, "wrongpass1");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("ユーザーIDまたはパスワードが正しくありません", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("008_パスワード誤り.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ATTEMPTS_USER_ID } });
    expect(after.failedAttempts).toBeGreaterThan(before.failedAttempts);
  });

  test("TC-009 連続失敗によるロック発生（事前にfailedAttemptsをMAX_ATTEMPTS-2へ設定済み）", async ({
    page,
  }) => {
    // MAX_ATTEMPTS - 1 回目: 通常の誤りメッセージ
    await page.goto("/login");
    await fillLoginForm(page, LOCKGEN_USER_ID, "wrongpass1");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("ユーザーIDまたはパスワードが正しくありません", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("009_ロック直前.png"), fullPage: true });
    // 直前の送信に伴う裏側の再取得が終わりきる前に次を送信すると、古い表示に
    // 上書きされる競合が起きるため、通信が落ち着くのを待ってから次に進む。
    await page.waitForLoadState("networkidle");

    // MAX_ATTEMPTS 回目: ロック発生
    await page.goto("/login");
    await fillLoginForm(page, LOCKGEN_USER_ID, "wrongpass1");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("アカウントがロックされています。管理者にお問い合わせください", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("009_ロック発生.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: LOCKGEN_USER_ID } });
    expect(user.failedAttempts).toBeGreaterThanOrEqual(env.MAX_ATTEMPTS);
    expect(user.lockedAt).not.toBeNull();
  });

  test("TC-010 ロック済みアカウントでのログイン試行", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, LOCKED_USER_ID, TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(
      page.getByText("アカウントがロックされています。管理者にお問い合わせください", {
        exact: true,
      }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("010_ロック済みログイン試行.png"), fullPage: true });
  });

  test("TC-011 ログイン成功時の失敗回数リセット", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: ATTEMPTS_USER_ID } });
    expect(before.failedAttempts).toBeGreaterThanOrEqual(1);

    await page.goto("/login");
    await fillLoginForm(page, ATTEMPTS_USER_ID, TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("011_失敗回数リセット後ログイン.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: ATTEMPTS_USER_ID } });
    expect(after.failedAttempts).toBe(0);
  });

  test("TC-012 未ログインでの保護ページへのアクセス制御", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("012_未ログインリダイレクト.png"), fullPage: true });
  });

  test("TC-013 未ログインで公開ページはリダイレクトされない", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({
      path: evidence("013_公開ページアクセス_forgot-password.png"),
      fullPage: true,
    });

    await page.goto("/about");
    await expect(page).not.toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("013_公開ページアクセス_about.png"), fullPage: true });
  });

  test("TC-014 初回パスワード変更への強制誘導", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, MUST_CHANGE_USER_ID, TEST_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    // ログインのServer Action発の遷移では、middlewareのリダイレクト先が画面には
    // 正しく反映される一方でアドレスバーのURLは更新されないため、URLではなく表示内容で確認する。
    await expect(page.getByRole("heading", { name: "パスワード変更" })).toBeVisible();
    await expect(page.getByText("初回ログインのため、パスワードの変更が必要です。")).toBeVisible();
    await page.screenshot({ path: evidence("014_初回パスワード変更誘導.png"), fullPage: true });
  });

  test("TC-015 管理者専用ページのアクセス制御", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, OPERATOR_LOGIN_ID, OPERATOR_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.goto("/admin/users");
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("015_管理者専用ページ制御.png"), fullPage: true });
  });

  test("TC-016 お知らせ管理ページのVIEWERアクセス制御", async ({ page }) => {
    await page.goto("/login");
    await fillLoginForm(page, VIEWER_LOGIN_ID, VIEWER_PASSWORD);
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");

    await page.goto("/news");
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("016_お知らせ管理VIEWER制御.png"), fullPage: true });
  });
});
