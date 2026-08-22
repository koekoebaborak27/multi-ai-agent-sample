import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/user/テスト結果UT_10_利用者メールアドレス管理",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123";

const DUP_USER_ID = "e2eUserDup";
const DUP_USER_EMAIL = "e2e-user-dup@example.com";
const NO_EMAIL_USER_ID = "e2eUserNoEmail";
const TARGET_USER_ID = "e2eUserTarget";
const TARGET_USER_EMAIL = "e2e-user-target@example.com";
const NEW_USER_ID = "e2eUserNew";
const NEW_USER_EMAIL = "e2e-user-new@example.com";
const DUP_ATTEMPT_USER_ID = "e2eUserDupAttempt";
const ALL_USER_IDS = [DUP_USER_ID, NO_EMAIL_USER_ID, TARGET_USER_ID, NEW_USER_ID, DUP_ATTEMPT_USER_ID];

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill("admin");
  await page.getByRole("textbox", { name: "パスワード" }).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

async function openEditDialog(page: Page, userId: string) {
  await page.getByRole("row", { name: userId }).getByRole("button", { name: "編集" }).click();
  return page.getByRole("dialog");
}

test.describe.serial("利用者メールアドレス管理（20.1）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    await prisma.user.create({
      data: { id: DUP_USER_ID, role: "VIEWER", email: DUP_USER_EMAIL, displayName: "E2E重複確認用" },
    });
    await prisma.user.create({
      data: { id: NO_EMAIL_USER_ID, role: "VIEWER", displayName: "E2E未登録編集確認用" },
    });
    await prisma.user.create({
      data: { id: TARGET_USER_ID, role: "VIEWER", email: TARGET_USER_EMAIL, displayName: "E2E編集対象" },
    });

    const before = await prisma.user.findMany({
      where: { id: { in: [DUP_USER_ID, NO_EMAIL_USER_ID, TARGET_USER_ID] } },
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

    await prisma.user.deleteMany({ where: { id: { in: ALL_USER_IDS } } });
    await prisma.$disconnect();
  });

  test("TC-001 新規登録でのメールアドレス登録", async ({ page }) => {
    await login(page);
    await page.goto("/admin/users");

    await page.getByRole("textbox", { name: "ユーザーID" }).fill(NEW_USER_ID);
    await page.getByRole("textbox", { name: "表示名" }).fill("E2E新規登録確認");
    await page.getByRole("textbox", { name: "メール" }).fill(NEW_USER_EMAIL);
    await page.getByRole("button", { name: "ユーザーを作成" }).click();

    await expect(page.getByText("ユーザーを作成しました")).toBeVisible();
    await expect(page.getByRole("row", { name: NEW_USER_ID })).toContainText(NEW_USER_EMAIL);
    await page.screenshot({ path: evidence("001_新規登録メール表示.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: NEW_USER_ID } });
    expect(user.email).toBe(NEW_USER_EMAIL);
  });

  test("TC-002 新規登録での重複メールアドレス", async ({ page }) => {
    await login(page);
    await page.goto("/admin/users");

    await page.getByRole("textbox", { name: "ユーザーID" }).fill(DUP_ATTEMPT_USER_ID);
    await page.getByRole("textbox", { name: "メール" }).fill(DUP_USER_EMAIL);
    await page.getByRole("button", { name: "ユーザーを作成" }).click();

    await expect(page.getByText("このメールアドレスは既に使われています", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_新規登録重複エラー.png"), fullPage: true });

    const count = await prisma.user.count({ where: { id: DUP_ATTEMPT_USER_ID } });
    expect(count).toBe(0);
  });

  test("TC-003 編集ダイアログの初期値表示", async ({ page }) => {
    await login(page);
    await page.goto("/admin/users");

    const dialog = await openEditDialog(page, TARGET_USER_ID);
    await expect(dialog.getByRole("textbox", { name: "メール" })).toHaveValue(TARGET_USER_EMAIL);
    await page.screenshot({ path: evidence("003_編集ダイアログ初期表示.png"), fullPage: true });
  });

  test("TC-004 編集でのメールアドレス変更", async ({ page }) => {
    const newEmail = "e2e-user-target-updated@example.com";

    await login(page);
    await page.goto("/admin/users");

    const dialog = await openEditDialog(page, TARGET_USER_ID);
    await dialog.getByRole("textbox", { name: "メール" }).fill(newEmail);
    await dialog.getByRole("button", { name: "保存する" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: TARGET_USER_ID })).toContainText(newEmail);
    await page.screenshot({ path: evidence("004_編集メール変更後.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: TARGET_USER_ID } });
    expect(user.email).toBe(newEmail);
  });

  test("TC-005 編集での重複メールアドレス", async ({ page }) => {
    await login(page);
    await page.goto("/admin/users");

    const before = await prisma.user.findUniqueOrThrow({ where: { id: TARGET_USER_ID } });

    const dialog = await openEditDialog(page, TARGET_USER_ID);
    await dialog.getByRole("textbox", { name: "メール" }).fill(DUP_USER_EMAIL);
    await dialog.getByRole("button", { name: "保存する" }).click();

    await expect(dialog.getByText("このメールアドレスは既に使われています", { exact: true })).toBeVisible();
    await expect(dialog).toBeVisible();
    await page.screenshot({ path: evidence("005_編集重複エラー.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: TARGET_USER_ID } });
    expect(after.email).toBe(before.email);
  });

  test("TC-006 未登録利用者の編集画面表示と空欄保存", async ({ page }) => {
    await login(page);
    await page.goto("/admin/users");

    const dialog = await openEditDialog(page, NO_EMAIL_USER_ID);
    await expect(dialog.getByRole("textbox", { name: "メール" })).toHaveValue("");
    await dialog.getByRole("button", { name: "保存する" }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row", { name: NO_EMAIL_USER_ID })).toContainText("-");
    await page.screenshot({ path: evidence("006_未登録編集空欄保存.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: NO_EMAIL_USER_ID } });
    expect(user.email).toBeNull();
  });
});
