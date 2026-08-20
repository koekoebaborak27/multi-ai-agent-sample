import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_13_マスタ更新",
);

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

async function selectCategory(page: Page, categoryLabel: string) {
  await page.getByRole("combobox", { name: "マスタ分類" }).click();
  await page.getByRole("option", { name: new RegExp(categoryLabel) }).click();
}

test.describe.serial("マスタ更新（MST-05 / MST-03）", () => {
  const categoryAName = "更新確認分類A";
  const categoryBName = "更新確認分類B";
  const categoryCName = "更新確認分類C（削除予定）";
  let categoryAId: number;
  let categoryBId: number;
  let categoryCId: number;
  let targetId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const categoryA = await prisma.masterCategory.create({ data: { name: categoryAName } });
    categoryAId = categoryA.id;
    const categoryB = await prisma.masterCategory.create({ data: { name: categoryBName } });
    categoryBId = categoryB.id;
    const categoryC = await prisma.masterCategory.create({ data: { name: categoryCName } });
    categoryCId = categoryC.id;

    await prisma.master.create({
      data: { categoryId: categoryBId, code: "OTHERDUP", content: "別コード重複確認用" },
    });

    fs.writeFileSync(
      evidence("db_before.json"),
      JSON.stringify({ categoryAId, categoryBId, categoryCId }, null, 2),
    );
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ categoryAId, categoryBId, categoryCId }, null, 2),
    );

    await prisma.master.deleteMany({ where: { categoryId: { in: [categoryAId, categoryBId] } } });
    await prisma.masterCategory.deleteMany({ where: { id: { in: [categoryAId, categoryBId] } } });
    // categoryCはTC-005でテスト内に削除される想定のため、残っていた場合のみ削除する
    const remainingC = await prisma.masterCategory.findUnique({ where: { id: categoryCId } });
    if (remainingC) {
      await prisma.masterCategory.delete({ where: { id: categoryCId } });
    }
    await prisma.$disconnect();
  });

  test.beforeEach(async () => {
    // 各テストケースで更新対象マスタを分類Aに作り直し、他のケースの結果に影響されないようにする
    await prisma.master.deleteMany({ where: { categoryId: categoryAId } });
    const target = await prisma.master.create({
      data: { categoryId: categoryAId, code: "TARGET01", content: "更新対象確認内容" },
    });
    targetId = target.id;
  });

  test("TC-001 3項目同時更新の完了（確認画面の表示項目を含む）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await selectCategory(page, categoryBName);
    await page.getByLabel("マスタコード").fill("UPDATED1");
    await page.getByLabel("マスタ内容").fill("更新後内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText("変更前のマスタ分類")).toBeVisible();
    await expect(page.getByText(categoryAName, { exact: true })).toBeVisible();
    await expect(page.getByText("変更後のマスタ分類")).toBeVisible();
    await expect(page.getByText("変更前のマスタコード")).toBeVisible();
    await expect(page.getByText("TARGET01", { exact: true })).toBeVisible();
    await expect(page.getByText("UPDATED1", { exact: true })).toBeVisible();
    await expect(page.getByText("更新後内容", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("001_更新確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(new RegExp(`/master/${targetId}\\?updated=1`));
    await expect(page.getByText("更新しました")).toBeVisible();
    await page.screenshot({ path: evidence("001_更新完了後詳細画面.png"), fullPage: true });
  });

  test("TC-002 値を変えずに更新する", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByText("（変更なし）").first()).toBeVisible();
    const unchangedCount = await page.getByText("（変更なし）").count();
    expect(unchangedCount).toBe(3);
    await page.screenshot({ path: evidence("002_値変更なし確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();
  });

  test("TC-003 所属分類だけを変更する", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await selectCategory(page, categoryBName);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    const unchangedCount = await page.getByText("（変更なし）").count();
    expect(unchangedCount).toBe(2);
    await page.screenshot({ path: evidence("003_所属分類のみ変更.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("更新しました")).toBeVisible();

    const updated = await prisma.master.findUniqueOrThrow({ where: { id: targetId } });
    expect(updated.categoryId).toBe(categoryBId);
    const categoryAStillExists = await prisma.masterCategory.findUnique({
      where: { id: categoryAId },
    });
    expect(categoryAStillExists).not.toBeNull();
  });

  test("TC-004 変更後コードの形式エラー", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByLabel("マスタコード").fill("abc123");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText(
        "マスタコードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_コード形式エラー.png"), fullPage: true });
  });

  test("TC-005 変更後の分類が存在しない", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await selectCategory(page, categoryCName);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    // 確認画面を表示したまま、他の利用者が先に分類Cを削除した状況をDB操作で再現する
    await prisma.masterCategory.delete({ where: { id: categoryCId } });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("対象のマスタ分類が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("005_分類存在しないエラー.png"), fullPage: true });

    const current = await prisma.master.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.categoryId).toBe(categoryAId);
  });

  test("TC-006 確認画面遷移時のコード重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await selectCategory(page, categoryBName);
    await page.getByLabel("マスタコード").fill("OTHERDUP");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText("同じマスタ分類に同じマスタコードが登録されています"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("006_確認画面遷移時重複エラー.png"), fullPage: true });
  });

  test("TC-007 実行時点のコード重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByLabel("マスタコード").fill("EXECDUP1");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await prisma.master.create({
      data: { categoryId: categoryAId, code: "EXECDUP1", content: "先行登録済みマスタ" },
    });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText("同じマスタ分類に同じマスタコードが登録されています"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("007_実行時重複エラー.png"), fullPage: true });

    const current = await prisma.master.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.code).toBe("TARGET01");
  });

  test("TC-008 同時更新エラー", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByLabel("マスタ内容").fill("同時更新確認内容");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await prisma.master.update({
      where: { id: targetId },
      data: { content: "先行更新済み内容" },
    });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText(
        "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("008_同時更新エラー.png"), fullPage: true });
  });

  test("TC-009 「入力内容を修正」での入力値保持", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByLabel("マスタ内容").fill("修正確認内容");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("マスタ内容")).toHaveValue("修正確認内容");
    await page.screenshot({ path: evidence("009_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-010 「キャンセル」での破棄", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/${targetId}/edit`);
    await page.getByLabel("マスタ内容").fill("キャンセル確認内容");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(`http://localhost:3000/master/${targetId}`);
    const current = await prisma.master.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.content).toBe("更新対象確認内容");
    await page.screenshot({ path: evidence("010_キャンセルで破棄.png"), fullPage: true });
  });

  test("TC-011 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto(`/master/${targetId}/edit`);

    await expect(page).toHaveURL(new RegExp(`/master/${targetId}(\\?|$)`));
    await page.screenshot({ path: evidence("011_VIEWER権限制御.png"), fullPage: true });
  });
});
