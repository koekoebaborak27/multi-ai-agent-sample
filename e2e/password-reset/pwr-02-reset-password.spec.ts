import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createToken, hashToken } from "../../src/modules/password-reset/token";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/password-reset/テスト結果UT_11_パスワード再設定",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const USER_ID = "e2eResetUser";
const LOCKED_USER_ID = "e2eResetUserLocked";
const TTL_MS = 30 * 60 * 1000;

// TC-002/008で使い回すURLの合言葉。TC-002で使用済みにし、TC-008で再アクセスする。
let reusedToken: string;

test.describe.serial("パスワード再設定（PWR-02）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    await prisma.user.create({
      data: { id: USER_ID, role: "VIEWER", displayName: "E2E再設定確認用" },
    });
    await prisma.user.create({
      data: {
        id: LOCKED_USER_ID,
        role: "VIEWER",
        displayName: "E2Eロック解除確認用",
        lockedAt: new Date(),
        failedAttempts: 5,
      },
    });

    const before = await prisma.user.findMany({
      where: { id: { in: [USER_ID, LOCKED_USER_ID] } },
      select: { id: true, lockedAt: true, failedAttempts: true, mustChangePassword: true },
    });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.user.findMany({
      where: { id: { in: [USER_ID, LOCKED_USER_ID] } },
      select: { id: true, lockedAt: true, failedAttempts: true, mustChangePassword: true },
    });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));

    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: [USER_ID, LOCKED_USER_ID] } } });
    await prisma.user.deleteMany({ where: { id: { in: [USER_ID, LOCKED_USER_ID] } } });
    await prisma.$disconnect();
  });

  test("TC-001 有効なURLを開いたときの表示", async ({ page }) => {
    const token = createToken();
    reusedToken = token;
    const now = new Date();
    await prisma.passwordResetToken.create({
      data: { userId: USER_ID, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TTL_MS) },
    });

    await page.goto(`/reset-password/${token}`);

    await expect(page.getByText("新しいパスワードの設定", { exact: true })).toBeVisible();
    await expect(page.getByLabel("新しいパスワード", { exact: true })).toBeVisible();
    await expect(page.getByLabel("新しいパスワード（確認）")).toBeVisible();
    await expect(page.getByRole("button", { name: "設定する" })).toBeVisible();
    await expect(page.getByText(USER_ID)).toHaveCount(0);
    await page.screenshot({ path: evidence("001_有効URL画面表示.png"), fullPage: true });
  });

  test("TC-002 パスワード設定の完了", async ({ page }) => {
    await page.goto(`/reset-password/${reusedToken}`);
    await page.getByLabel("新しいパスワード", { exact: true }).fill("newpass123");
    await page.getByLabel("新しいパスワード（確認）").fill("newpass123");
    await page.getByRole("button", { name: "設定する" }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(
      page.getByText("パスワードを変更しました。新しいパスワードでログインしてください。"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("002_設定完了後ログイン画面.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } });
    expect(user.passwordHash).not.toBeNull();
    expect(user.mustChangePassword).toBe(false);
    expect(user.failedAttempts).toBe(0);
    expect(user.lockedAt).toBeNull();

    const token = await prisma.passwordResetToken.findFirst({
      where: { userId: USER_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(token?.usedAt).not.toBeNull();
  });

  test("TC-003 期限切れURLを開いたときの表示", async ({ page }) => {
    const token = createToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: USER_ID,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() - 60 * 1000),
      },
    });

    await page.goto(`/reset-password/${token}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "このURLは使用済みか、有効期限が切れています。お手数ですが、もう一度お申し込みください。",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "再発行を申し込む" })).toHaveAttribute(
      "href",
      "/forgot-password",
    );
    await page.screenshot({ path: evidence("003_期限切れURL表示.png"), fullPage: true });
  });

  test("TC-004 使用済み・不正なURLを開いたときの表示", async ({ page }) => {
    const token = createToken();
    const now = new Date();
    await prisma.passwordResetToken.create({
      data: {
        userId: USER_ID,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TTL_MS),
        usedAt: now,
      },
    });

    await page.goto(`/reset-password/${token}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("004_使用済み不正URL表示.png"), fullPage: true });
  });

  test("TC-005 確認用パスワードの不一致", async ({ page }) => {
    const token = createToken();
    const now = new Date();
    await prisma.passwordResetToken.create({
      data: { userId: USER_ID, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TTL_MS) },
    });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).passwordHash;

    await page.goto(`/reset-password/${token}`);
    await page.getByLabel("新しいパスワード", { exact: true }).fill("newpass123");
    await page.getByLabel("新しいパスワード（確認）").fill("newpass456");
    await page.getByRole("button", { name: "設定する" }).click();

    await expect(page.getByText("新しいパスワードが一致しません", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("005_パスワード不一致エラー.png"), fullPage: true });

    const after = (await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).passwordHash;
    expect(after).toBe(before);
  });

  test("TC-006 新しいパスワードの文字数不足", async ({ page }) => {
    const token = createToken();
    const now = new Date();
    await prisma.passwordResetToken.create({
      data: { userId: USER_ID, tokenHash: hashToken(token), expiresAt: new Date(now.getTime() + TTL_MS) },
    });
    const before = (await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).passwordHash;

    await page.goto(`/reset-password/${token}`);
    await page.getByLabel("新しいパスワード", { exact: true }).fill("abc123x");
    await page.getByLabel("新しいパスワード（確認）").fill("abc123x");
    await page.getByRole("button", { name: "設定する" }).click();

    await expect(page.getByText("新しいパスワードは8文字以上にしてください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("006_文字数不足エラー.png"), fullPage: true });

    const after = (await prisma.user.findUniqueOrThrow({ where: { id: USER_ID } })).passwordHash;
    expect(after).toBe(before);
  });

  test("TC-007 ロック中の利用者の解除", async ({ page }) => {
    const token = createToken();
    const now = new Date();
    await prisma.passwordResetToken.create({
      data: {
        userId: LOCKED_USER_ID,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + TTL_MS),
      },
    });

    await page.goto(`/reset-password/${token}`);
    await page.getByLabel("新しいパスワード", { exact: true }).fill("unlocked123");
    await page.getByLabel("新しいパスワード（確認）").fill("unlocked123");
    await page.getByRole("button", { name: "設定する" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("007_ロック解除後ログイン画面.png"), fullPage: true });

    await page.getByLabel("ユーザーID").fill(LOCKED_USER_ID);
    await page.getByRole("textbox", { name: "パスワード" }).fill("unlocked123");
    await page.getByRole("button", { name: "ログイン" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.screenshot({ path: evidence("007_ロック解除後ログイン成功.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: LOCKED_USER_ID } });
    expect(user.lockedAt).toBeNull();
    expect(user.failedAttempts).toBe(0);
  });

  test("TC-008 設定完了後に同じURLを再度開いたときの表示", async ({ page }) => {
    await page.goto(`/reset-password/${reusedToken}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("008_使用済みURL再アクセス.png"), fullPage: true });
  });
});
