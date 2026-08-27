import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/shared/security/password";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/auth/テスト結果UT_11_初回パスワード変更画面",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const OLD_PASSWORD = "OldPass12";

const NORMAL_USER_ID = "e2ePwdNormal";
const SUCCESS_USER_ID = "e2ePwdSuccess";
const MUST_CHANGE_USER_ID = "e2ePwdMustChange";
const BOUNDARY_USER_ID = "e2ePwdBoundary";
const ALL_USER_IDS = [NORMAL_USER_ID, SUCCESS_USER_ID, MUST_CHANGE_USER_ID, BOUNDARY_USER_ID];

// 128文字ちょうど・英数字混在のパスワード（"A1" + "b2"を63回繰り返し = 2 + 126 = 128文字）
const NEW_PASSWORD_128 = "A1" + "b2".repeat(63);
// 8文字ちょうど・英数字混在のパスワード
const NEW_PASSWORD_8 = "Passw0rd";

async function login(page: Page, userId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(userId);
  await page.getByRole("textbox", { name: "パスワード" }).fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  // ログイン後の画面遷移が終わりきる前に次の操作へ進むと競合するため、
  // ログイン画面から離れる（=ログインが完了した）のを待ってから次に進む。
  await page.waitForURL((url) => url.pathname !== "/login");
}

// HTML標準のrequired属性が先に画面をせき止めてしまい、サーバー側の入力チェックまで
// 届かないため、未入力系のテストケースではこの属性を外してから送信する。
async function removeRequired(page: Page, id: string) {
  await page.locator(`#${id}`).evaluate((el) => el.removeAttribute("required"));
}

async function fillChangeForm(
  page: Page,
  values: { current?: string; next?: string; confirm?: string },
) {
  if (values.current !== undefined) {
    await page.locator("#currentPassword").fill(values.current);
  }
  if (values.next !== undefined) {
    await page.locator("#newPassword").fill(values.next);
  }
  if (values.confirm !== undefined) {
    await page.locator("#confirmPassword").fill(values.confirm);
  }
}

test.describe.serial("パスワード変更画面（LGN-02）", () => {
  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const passwordHash = await hashPassword(OLD_PASSWORD);

    await prisma.user.create({ data: { id: NORMAL_USER_ID, role: "VIEWER", passwordHash } });
    await prisma.user.create({ data: { id: SUCCESS_USER_ID, role: "VIEWER", passwordHash } });
    await prisma.user.create({
      data: { id: MUST_CHANGE_USER_ID, role: "VIEWER", passwordHash, mustChangePassword: true },
    });
    await prisma.user.create({ data: { id: BOUNDARY_USER_ID, role: "VIEWER", passwordHash } });

    const before = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, mustChangePassword: true, failedAttempts: true },
    });
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(before, null, 2));
  });

  test.afterAll(async () => {
    const after = await prisma.user.findMany({
      where: { id: { in: ALL_USER_IDS } },
      select: { id: true, mustChangePassword: true, failedAttempts: true },
    });
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify(after, null, 2));

    await prisma.user.deleteMany({ where: { id: { in: ALL_USER_IDS } } });
    await prisma.$disconnect();
  });

  test("TC-001 通常アクセスでのパスワード変更成功", async ({ page }) => {
    await login(page, SUCCESS_USER_ID, OLD_PASSWORD);
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.goto("/settings/password");

    const newPassword = "NewPass99";
    await fillChangeForm(page, { current: OLD_PASSWORD, next: newPassword, confirm: newPassword });
    await page.getByRole("button", { name: "パスワードを変更" }).click();

    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("001_パスワード変更成功.png"), fullPage: true });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: SUCCESS_USER_ID } });
    expect(user.passwordHash).not.toBeNull();
    expect(user.mustChangePassword).toBe(false);
    expect(user.failedAttempts).toBe(0);
  });

  test("TC-002 初回ログイン時の案内表示", async ({ page }) => {
    await login(page, MUST_CHANGE_USER_ID, OLD_PASSWORD);
    // ログインのServer Action発の遷移では、middlewareのリダイレクト先が画面には
    // 正しく反映される一方でアドレスバーのURLは更新されないため、URLではなく表示内容で確認する。
    await expect(page.getByRole("heading", { name: "パスワード変更" })).toBeVisible();
    await expect(page.getByText("初回ログインのため、パスワードの変更が必要です。")).toBeVisible();
    await page.screenshot({ path: evidence("002_初回ログイン案内.png"), fullPage: true });
  });

  test("TC-003 現在のパスワード未入力", async ({ page }) => {
    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await removeRequired(page, "currentPassword");
    await fillChangeForm(page, { next: "NewPass99", confirm: "NewPass99" });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("現在のパスワードを入力してください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("003_現在パスワード未入力.png"), fullPage: true });
  });

  test("TC-004 新しいパスワードの文字数不足", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, { current: OLD_PASSWORD, next: "abc123x", confirm: "abc123x" });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(
      page.getByText("新しいパスワードは8文字以上にしてください", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_文字数不足.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-005 新しいパスワードに英字を含まない", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, { current: OLD_PASSWORD, next: "12345678", confirm: "12345678" });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("英字を含めてください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("005_英字なし.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-006 新しいパスワードに数字を含まない", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, { current: OLD_PASSWORD, next: "abcdefgh", confirm: "abcdefgh" });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("数字を含めてください", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("006_数字なし.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-007 確認用パスワードの不一致", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, {
      current: OLD_PASSWORD,
      next: "newpass123",
      confirm: "newpass456",
    });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(page.getByText("新しいパスワードが一致しません", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("007_確認用不一致.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-008 確認用パスワード未入力", async ({ page }) => {
    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await removeRequired(page, "confirmPassword");
    await fillChangeForm(page, { current: OLD_PASSWORD, next: "NewPass99" });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(
      page.getByText("確認用パスワードを入力してください", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("008_確認用未入力.png"), fullPage: true });
  });

  test("TC-009 現在のパスワードの誤り", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, {
      current: "WrongPass1",
      next: "NewPass99",
      confirm: "NewPass99",
    });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(
      page.getByText("ユーザーIDまたはパスワードが正しくありません", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("009_現在パスワード誤り.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-010 新しいパスワードが現在のパスワードと同じ", async ({ page }) => {
    const before = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });

    await login(page, NORMAL_USER_ID, OLD_PASSWORD);
    await page.goto("/settings/password");
    await fillChangeForm(page, {
      current: OLD_PASSWORD,
      next: OLD_PASSWORD,
      confirm: OLD_PASSWORD,
    });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    await expect(
      page.getByText("現在のパスワードと異なるものにしてください", { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: evidence("010_現在と同一.png"), fullPage: true });

    const after = await prisma.user.findUniqueOrThrow({ where: { id: NORMAL_USER_ID } });
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  test("TC-011 新しいパスワード8文字・128文字ちょうどでの成功", async ({ page }) => {
    expect(NEW_PASSWORD_8.length).toBe(8);
    expect(NEW_PASSWORD_128.length).toBe(128);

    // (a) 8文字ちょうど
    const beforeA = await prisma.user.findUniqueOrThrow({ where: { id: BOUNDARY_USER_ID } });
    await login(page, BOUNDARY_USER_ID, OLD_PASSWORD);
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.goto("/settings/password");
    await fillChangeForm(page, {
      current: OLD_PASSWORD,
      next: NEW_PASSWORD_8,
      confirm: NEW_PASSWORD_8,
    });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    // 現在パスワードの照合と新パスワードのハッシュ化の2回分Argon2idの計算が続くため、長めに待つ
    await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
    await page.screenshot({ path: evidence("011_8文字境界.png"), fullPage: true });

    const afterA = await prisma.user.findUniqueOrThrow({ where: { id: BOUNDARY_USER_ID } });
    expect(afterA.passwordHash).not.toBe(beforeA.passwordHash);

    // (b) 128文字ちょうど（(a)で変更した8文字パスワードで再ログインする）
    await login(page, BOUNDARY_USER_ID, NEW_PASSWORD_8);
    await expect(page).toHaveURL("http://localhost:3000/");
    await page.goto("/settings/password");
    await fillChangeForm(page, {
      current: NEW_PASSWORD_8,
      next: NEW_PASSWORD_128,
      confirm: NEW_PASSWORD_128,
    });
    await page.getByRole("button", { name: "パスワードを変更" }).click();
    // 現在パスワードの照合と新パスワードのハッシュ化の2回分Argon2idの計算が続くため、長めに待つ
    await expect(page).toHaveURL(/\/login/, { timeout: 30000 });
    await page.screenshot({ path: evidence("011_128文字境界.png"), fullPage: true });

    const afterB = await prisma.user.findUniqueOrThrow({ where: { id: BOUNDARY_USER_ID } });
    expect(afterB.passwordHash).not.toBe(afterA.passwordHash);
  });

  test("TC-012 未ログインでのアクセス制御", async ({ page }) => {
    await page.goto("/settings/password");
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("012_未ログインリダイレクト.png"), fullPage: true });
  });
});
