import fs from "node:fs";
import path from "node:path";
import { hashPassword } from "../../src/shared/security/password";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/password-reset/テスト結果UT_20_メールアドレス変更申込",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

// ログイン確認に使うテスト専用アカウント。パスワードは既存のSEED_ADMIN_PASSWORDを流用する。
const PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";

const USER_A_ID = "e2eEmlUserA";
const USER_A_EMAIL = "e2e-eml-a@example.com";
const USER_NO_EMAIL_ID = "e2eEmlUserNoEmail";
const USER_OTHER_ID = "e2eEmlUserOther";
const USER_OTHER_EMAIL = "e2e-eml-other@example.com";

async function login(page: Page, id: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe.serial("メールアドレス変更申込（EML-01）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const passwordHash = await hashPassword(PASSWORD);

    await prisma.user.create({
      data: {
        id: USER_A_ID,
        role: "VIEWER",
        email: USER_A_EMAIL,
        passwordHash,
        displayName: "E2E申込確認用A",
      },
    });
    await prisma.user.create({
      data: {
        id: USER_NO_EMAIL_ID,
        role: "VIEWER",
        passwordHash,
        displayName: "E2E未登録申込確認用",
      },
    });
    await prisma.user.create({
      data: {
        id: USER_OTHER_ID,
        role: "VIEWER",
        email: USER_OTHER_EMAIL,
        displayName: "E2E重複確認用",
      },
    });

    const before = await prisma.user.findMany({
      where: { id: { in: [USER_A_ID, USER_NO_EMAIL_ID, USER_OTHER_ID] } },
      select: { id: true, email: true },
    });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.user.findMany({
      where: { id: { in: [USER_A_ID, USER_NO_EMAIL_ID, USER_OTHER_ID] } },
      select: { id: true, email: true },
    });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));

    await prisma.emailChangeToken.deleteMany({
      where: { userId: { in: [USER_A_ID, USER_NO_EMAIL_ID, USER_OTHER_ID] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [USER_A_ID, USER_NO_EMAIL_ID, USER_OTHER_ID] } },
    });
    await prisma.$disconnect();
  });

  test("TC-001 メールアドレス登録済み利用者の画面表示", async ({ page }) => {
    await login(page, USER_A_ID);
    await page.goto("/settings/email");

    await expect(page.getByText(USER_A_EMAIL)).toBeVisible();
    await expect(page.getByLabel("新しいメールアドレス")).toBeVisible();
    await expect(page.getByRole("button", { name: "確認メールを送る" })).toBeVisible();
    await page.screenshot({ path: evidence("001_登録済み画面表示.png"), fullPage: true });
  });

  test("TC-002 メールアドレス未登録利用者の画面表示", async ({ page }) => {
    await login(page, USER_NO_EMAIL_ID);
    await page.goto("/settings/email");

    await expect(page.getByText("未登録", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_未登録画面表示.png"), fullPage: true });
  });

  test("TC-003 メールアドレス変更申し込みの完了", async ({ page }) => {
    const newEmail = "e2e-eml-a-new@example.com";
    const beforeCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });

    await login(page, USER_A_ID);
    await page.goto("/settings/email");
    await page.getByLabel("新しいメールアドレス").fill(newEmail);
    await page.getByRole("button", { name: "確認メールを送る" }).click();

    await expect(page.getByLabel("新しいメールアドレス")).toHaveCount(0);
    await expect(
      page.getByText(
        "入力されたアドレスに確認用のURLをお送りしました。URLを開くと変更が完了します。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("003_申し込み完了後.png"), fullPage: true });

    const afterCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });
    expect(afterCount).toBe(beforeCount + 1);
    const token = await prisma.emailChangeToken.findFirst({
      where: { userId: USER_A_ID },
      orderBy: { createdAt: "desc" },
    });
    expect(token?.newEmail).toBe(newEmail);
    expect(token?.usedAt).toBeNull();

    const user = await prisma.user.findUniqueOrThrow({ where: { id: USER_A_ID } });
    expect(user.email).toBe(USER_A_EMAIL);
  });

  test("TC-004 現在のアドレスと同じ値を入力", async ({ page }) => {
    const beforeCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });

    await login(page, USER_A_ID);
    await page.goto("/settings/email");
    await page.getByLabel("新しいメールアドレス").fill(USER_A_EMAIL.toUpperCase());
    await page.getByRole("button", { name: "確認メールを送る" }).click();

    await expect(page.getByText("現在のメールアドレスと同じです", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("004_同一アドレスエラー.png"), fullPage: true });

    const afterCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });
    expect(afterCount).toBe(beforeCount);
  });

  test("TC-005 他利用者が使用中のアドレスを入力", async ({ page }) => {
    const beforeCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });

    await login(page, USER_A_ID);
    await page.goto("/settings/email");
    await page.getByLabel("新しいメールアドレス").fill(USER_OTHER_EMAIL);
    await page.getByRole("button", { name: "確認メールを送る" }).click();

    await expect(
      page.getByText("このメールアドレスは既に使われています", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("005_重複アドレスエラー.png"), fullPage: true });

    const afterCount = await prisma.emailChangeToken.count({ where: { userId: USER_A_ID } });
    expect(afterCount).toBe(beforeCount);
  });

  test("TC-006 未ログイン状態でのアクセス", async ({ page }) => {
    await page.goto("/settings/email");

    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("006_未ログインリダイレクト.png"), fullPage: true });
  });
});
