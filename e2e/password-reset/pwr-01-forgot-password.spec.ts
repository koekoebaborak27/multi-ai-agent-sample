import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createToken, hashToken } from "../../src/modules/password-reset/token";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/password-reset/テスト結果UT_10_パスワード再発行申請",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

// このテスト専用に作る利用者。既存のadmin等には触れず、テスト終了後にすべて削除する。
const USER_ID = "e2eForgotUser";
const USER_EMAIL = "e2e-forgot-user@example.com";
const LIMIT_USER_ID = "e2eForgotUserLimit";
const LIMIT_USER_EMAIL = "e2e-forgot-limit@example.com";
const NOT_FOUND_EMAIL = "e2e-forgot-notfound@example.com";

test.describe.serial("パスワード再発行申請（PWR-01）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    await prisma.user.create({
      data: { id: USER_ID, role: "VIEWER", email: USER_EMAIL, displayName: "E2E申請確認用" },
    });
    await prisma.user.create({
      data: { id: LIMIT_USER_ID, role: "VIEWER", email: LIMIT_USER_EMAIL, displayName: "E2E上限確認用" },
    });
    // 24時間以内に5件のPasswordResetTokenを用意し、送信回数の上限到達を再現する（TC-004用）
    const now = new Date();
    await prisma.passwordResetToken.createMany({
      data: Array.from({ length: 5 }, () => ({
        userId: LIMIT_USER_ID,
        tokenHash: hashToken(createToken()),
        expiresAt: new Date(now.getTime() + 30 * 60 * 1000),
        createdAt: now,
      })),
    });

    const before = await prisma.passwordResetToken.findMany({
      where: { userId: { in: [USER_ID, LIMIT_USER_ID] } },
      orderBy: { createdAt: "asc" },
    });
    fs.writeFileSync(
      evidence("db_before.json"),
      JSON.stringify(before.map((t) => ({ userId: t.userId, usedAt: t.usedAt })), null, 2),
    );
  });

  test.afterAll(async () => {
    const after = await prisma.passwordResetToken.findMany({
      where: { userId: { in: [USER_ID, LIMIT_USER_ID] } },
      orderBy: { createdAt: "asc" },
    });
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify(after.map((t) => ({ userId: t.userId, usedAt: t.usedAt })), null, 2),
    );

    await prisma.passwordResetToken.deleteMany({ where: { userId: { in: [USER_ID, LIMIT_USER_ID] } } });
    await prisma.user.deleteMany({ where: { id: { in: [USER_ID, LIMIT_USER_ID] } } });
    await prisma.$disconnect();
  });

  test("TC-001 入力前の画面表示", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByText("パスワードの再設定", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "登録されているメールアドレスを入力してください。パスワードを再設定するためのURLをお送りします。",
      ),
    ).toBeVisible();
    await expect(page.getByLabel("メールアドレス")).toBeVisible();
    await expect(page.getByRole("button", { name: "再設定用のURLを送る" })).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン画面へ戻る" })).toBeVisible();
    await page.screenshot({ path: evidence("001_入力前画面.png"), fullPage: true });
  });

  test("TC-002 登録済みメールアドレスでの送信", async ({ page }) => {
    const beforeCount = await prisma.passwordResetToken.count({ where: { userId: USER_ID } });

    await page.goto("/forgot-password");
    await page.getByLabel("メールアドレス").fill(USER_EMAIL);
    await page.getByRole("button", { name: "再設定用のURLを送る" }).click();

    await expect(page.getByLabel("メールアドレス")).toHaveCount(0);
    await expect(
      page.getByText(
        "入力されたメールアドレスが登録されている場合、再設定用のURLをお送りしました。メールをご確認ください。",
      ),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "ログイン画面へ戻る" })).toBeVisible();
    await page.screenshot({ path: evidence("002_登録済みアドレス送信後.png"), fullPage: true });

    const afterCount = await prisma.passwordResetToken.count({ where: { userId: USER_ID } });
    expect(afterCount).toBe(beforeCount + 1);
    const latest = await prisma.passwordResetToken.findFirst({
      where: { userId: USER_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(latest?.usedAt).toBeNull();
  });

  test("TC-003 未登録メールアドレスでの送信", async ({ page }) => {
    const beforeCount = await prisma.passwordResetToken.count();

    await page.goto("/forgot-password");
    await page.getByLabel("メールアドレス").fill(NOT_FOUND_EMAIL);
    await page.getByRole("button", { name: "再設定用のURLを送る" }).click();

    await expect(
      page.getByText(
        "入力されたメールアドレスが登録されている場合、再設定用のURLをお送りしました。メールをご確認ください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("003_未登録アドレス送信後.png"), fullPage: true });

    const afterCount = await prisma.passwordResetToken.count();
    expect(afterCount).toBe(beforeCount);
  });

  test("TC-004 24時間の送信回数上限到達時の送信", async ({ page }) => {
    const beforeCount = await prisma.passwordResetToken.count({ where: { userId: LIMIT_USER_ID } });
    expect(beforeCount).toBe(5);

    await page.goto("/forgot-password");
    await page.getByLabel("メールアドレス").fill(LIMIT_USER_EMAIL);
    await page.getByRole("button", { name: "再設定用のURLを送る" }).click();

    await expect(
      page.getByText(
        "入力されたメールアドレスが登録されている場合、再設定用のURLをお送りしました。メールをご確認ください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_送信上限到達後.png"), fullPage: true });

    const afterCount = await prisma.passwordResetToken.count({ where: { userId: LIMIT_USER_ID } });
    expect(afterCount).toBe(5);
  });

  test("TC-005 ログイン画面からのリンク遷移", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "パスワードを忘れた場合はこちら" }).click();

    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByText("パスワードの再設定", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("005_ログイン画面リンク.png"), fullPage: true });
  });
});
