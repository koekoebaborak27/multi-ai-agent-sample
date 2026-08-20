import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(process.cwd(), "docs/test/unit/result/master/テスト結果UT_12_マスタ詳細");

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  role: "ADMIN",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
};
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

test.describe.serial("マスタ詳細（MST-04）", () => {
  let categoryId: number;
  let displayMasterId: number;
  let noOwnerMasterId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const category = await prisma.masterCategory.create({ data: { name: "詳細確認用分類" } });
    categoryId = category.id;

    const displayMaster = await prisma.master.create({
      data: {
        categoryId,
        code: "DETAIL01",
        content: "詳細表示確認内容",
        createdBy: "admin",
        updatedBy: "admin",
      },
    });
    displayMasterId = displayMaster.id;

    const noOwnerMaster = await prisma.master.create({
      data: { categoryId, code: "NOOWNER1", content: "登録者不明確認内容" },
    });
    noOwnerMasterId = noOwnerMaster.id;

    fs.writeFileSync(
      evidence("db_before_Master.json"),
      JSON.stringify({ categoryId, displayMasterId, noOwnerMasterId }, null, 2),
    );
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after_Master.json"),
      JSON.stringify({ categoryId, displayMasterId, noOwnerMasterId }, null, 2),
    );

    await prisma.master.deleteMany({ where: { categoryId } });
    await prisma.masterCategory.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  test("TC-001 初期表示（全表示項目）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${displayMasterId}`);

    await expect(page.getByRole("heading", { name: "マスタ詳細" })).toBeVisible();
    await expect(page.getByText("詳細確認用分類", { exact: true })).toBeVisible();
    await expect(page.getByText("DETAIL01", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("詳細表示確認内容", { exact: true })).toBeVisible();
    await expect(page.getByText("登録日時")).toBeVisible();
    await expect(page.getByText("登録者")).toBeVisible();
    await expect(page.getByText("最終更新日時")).toBeVisible();
    await expect(page.getByText("最終更新者")).toBeVisible();
    await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: evidence("001_マスタ詳細初期表示.png"), fullPage: true });
  });

  test("TC-002 存在しないマスタIDでの404表示", async ({ page }) => {
    const nonExistentId = 999999999;
    await login(page, ADMIN);
    const response = await page.goto(`/master/${nonExistentId}`);
    expect(response?.status()).toBe(404);
    await page.screenshot({ path: evidence("002_存在しないマスタID_404.png"), fullPage: true });
  });

  test("TC-003 「編集する」「削除」ボタンの表示制御", async ({ browser }) => {
    const cases = [
      [ADMIN, true],
      [VIEWER, false],
    ] as const;

    for (const [user, expectVisible] of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user);
      await page.goto(`/master/${displayMasterId}`);

      const updateButton = page.getByRole("link", { name: "編集する" });
      const deleteButton = page.getByRole("button", { name: "削除" });
      if (expectVisible) {
        await expect(updateButton).toBeVisible();
        await expect(deleteButton).toBeVisible();
      } else {
        await expect(updateButton).toHaveCount(0);
        await expect(deleteButton).toHaveCount(0);
      }
      await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();
      await page.screenshot({
        path: evidence(`003_更新削除ボタン権限確認_${user.role}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });

  test("TC-004 登録直後の完了メッセージ表示", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${displayMasterId}?created=1`);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("004_登録直後メッセージ.png"), fullPage: true });
  });

  test("TC-005 更新直後の完了メッセージ表示", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${displayMasterId}?updated=1`);
    await expect(page.getByText("更新しました")).toBeVisible();
    await page.screenshot({ path: evidence("005_更新直後メッセージ.png"), fullPage: true });
  });

  test("TC-006 登録者・更新者が不明な場合の表示", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${noOwnerMasterId}`);
    await expect(page.getByText("—")).toHaveCount(2);
    await page.screenshot({ path: evidence("006_登録者更新者不明表示.png"), fullPage: true });
  });

  test("TC-007 「一覧へ戻る」ボタンでの画面遷移", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${displayMasterId}?returnTo=%2Fmaster%3FcategoryId%3Dall`);
    await page.getByRole("link", { name: "一覧へ戻る" }).click();
    await expect(page).toHaveURL("http://localhost:3000/master?categoryId=all");
    await page.screenshot({ path: evidence("007_一覧へ戻る遷移.png"), fullPage: true });
  });

  test("TC-008 「編集する」ボタンでの画面遷移", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${displayMasterId}`);
    await page.getByRole("link", { name: "編集する" }).click();
    await expect(page).toHaveURL(new RegExp(`/master/${displayMasterId}/edit`));
    await page.screenshot({ path: evidence("008_編集するボタン遷移.png"), fullPage: true });
  });
});
