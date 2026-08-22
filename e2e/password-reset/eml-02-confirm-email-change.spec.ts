import fs from "node:fs";
import path from "node:path";
import { hash } from "@node-rs/argon2";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createToken, hashToken } from "../../src/modules/password-reset/token";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/password-reset/テスト結果UT_21_メールアドレス変更確認",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";
const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
const TTL_MS = 30 * 60 * 1000;

const USER_A_ID = "e2eEmlConfirmA";
const USER_B_ID = "e2eEmlConfirmB";
const USER_C_ID = "e2eEmlConfirmC";
const USER_D_ID = "e2eEmlConfirmD";
const USER_EXPIRED_ID = "e2eEmlConfirmExpired";
const ALL_USER_IDS = [USER_A_ID, USER_B_ID, USER_C_ID, USER_D_ID, USER_EXPIRED_ID];

async function login(page: Page, id: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

async function createEmailChangeToken(userId: string, newEmail: string, expiresInMs = TTL_MS) {
  const token = createToken();
  await prisma.emailChangeToken.create({
    data: {
      userId,
      newEmail,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + expiresInMs),
    },
  });
  return token;
}

test.describe.serial("メールアドレス変更確認（EML-02）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const passwordHash = await hash(PASSWORD, ARGON2_OPTS);

    await prisma.user.createMany({
      data: ALL_USER_IDS.map((id) => ({
        id,
        role: "VIEWER",
        passwordHash,
        displayName: `E2E確認用${id}`,
      })),
    });

    const before = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, email: true },
    });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, email: true },
    });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));

    await prisma.emailChangeToken.deleteMany({ where: { userId: { in: ALL_USER_IDS } } });
    await prisma.user.deleteMany({ where: { id: { in: ALL_USER_IDS } } });
    await prisma.$disconnect();
  });

  test("TC-001 有効なURLを開いたときの完了表示", async ({ page }) => {
    const newEmail = "e2e-eml-confirm-a@example.com";
    const token = await createEmailChangeToken(USER_A_ID, newEmail);

    await login(page, USER_A_ID);
    await page.goto(`/settings/email/confirm/${token}`);

    await expect(page.getByText("変更が完了しました", { exact: true })).toBeVisible();
    await expect(
      page.getByText(`メールアドレスを変更しました。新しいメールアドレス: ${newEmail}`),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "メールアドレス設定へ戻る" })).toHaveAttribute(
      "href",
      "/settings/email",
    );
    await page.screenshot({ path: evidence("001_変更完了表示.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: USER_A_ID } });
    expect(user.email).toBe(newEmail);
    const tokenRecord = await prisma.emailChangeToken.findFirst({ where: { userId: USER_A_ID } });
    expect(tokenRecord?.usedAt).not.toBeNull();
  });

  test("TC-002 期限切れ・使用済みURLを開いたときの表示", async ({ page }) => {
    const token = await createEmailChangeToken(
      USER_EXPIRED_ID,
      "e2e-eml-confirm-expired@example.com",
      -60 * 1000,
    );

    await login(page, USER_EXPIRED_ID);
    await page.goto(`/settings/email/confirm/${token}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await expect(
      page.getByText(
        "このURLは使用済みか、有効期限が切れています。お手数ですが、もう一度お申し込みください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("002_期限切れ使用済み表示.png"), fullPage: true });
  });

  test("TC-003 申込者と異なる利用者でのアクセス", async ({ page }) => {
    const newEmail = "e2e-eml-confirm-a-2@example.com";
    const token = await createEmailChangeToken(USER_A_ID, newEmail);
    const before = await prisma.user.findUniqueOrThrow({ where: { id: USER_A_ID } });

    await login(page, USER_B_ID);
    await page.goto(`/settings/email/confirm/${token}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("003_申込者以外アクセス表示.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: USER_A_ID } });
    expect(after.email).toBe(before.email);
    const tokenRecord = await prisma.emailChangeToken.findFirst({
      where: { userId: USER_A_ID, newEmail },
    });
    expect(tokenRecord?.usedAt).toBeNull();
  });

  test("TC-004 未ログイン状態でのアクセス", async ({ page }) => {
    const token = await createEmailChangeToken(USER_A_ID, "e2e-eml-confirm-a-3@example.com");

    await page.goto(`/settings/email/confirm/${token}`);

    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("004_未ログインリダイレクト.png"), fullPage: true });
  });

  test("TC-005 確定直前に変更先アドレスが他利用者に使われていた場合", async ({ page }) => {
    const newEmail = "e2e-eml-confirm-taken@example.com";
    const token = await createEmailChangeToken(USER_C_ID, newEmail);
    // Cの申し込み後、変更先アドレスを利用者Dが先に登録済みにしておく
    await prisma.user.update({ where: { id: USER_D_ID }, data: { email: newEmail } });
    const before = await prisma.user.findUniqueOrThrow({ where: { id: USER_C_ID } });

    await login(page, USER_C_ID);
    await page.goto(`/settings/email/confirm/${token}`);

    await expect(page.getByText("このURLは使えません", { exact: true })).toBeVisible();
    await expect(page.getByText("このメールアドレスは既に使われています")).toBeVisible();
    await expect(page.getByRole("link", { name: "メールアドレス設定へ戻る" })).toBeVisible();
    await page.screenshot({ path: evidence("005_変更先重複表示.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: USER_C_ID } });
    expect(after.email).toBe(before.email);
  });
});
