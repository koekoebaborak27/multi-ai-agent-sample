import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_10_マスタ検索一覧",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  role: "ADMIN",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
};
const OPERATOR = {
  id: "opeTest",
  role: "OPERATOR",
  password: process.env.SEED_OPERATOR_PASSWORD ?? "test@123",
};
const VIEWER = {
  id: "viwTest",
  role: "VIEWER",
  password: process.env.SEED_VIEWER_PASSWORD ?? "test@123",
};

const CATEGORY_A_NAME = "検索確認分類A";
const CATEGORY_B_NAME = "検索確認分類B";
const CATEGORY_A_MASTER_COUNT = 32; // AB01を含め32件（ページング確認のため30件を超える件数にする）
const CATEGORY_B_MASTER_COUNT = 2;

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe.serial("マスタ検索一覧（MST-01）", () => {
  // テスト前の既存データ。全ケース終了後に同内容で復元するために保持する。
  let backupCategories: { name: string; masters: { code: string; content: string }[] }[] = [];
  let categoryAId: number;
  let categoryBId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    // 既存データを退避してから全削除し、分類の並び順（id昇順=名前昇順になるようにA→Bの順で作成）を確定させる
    const categories = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    backupCategories = categories.map((c) => ({ name: c.name, masters: c.masters }));
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(backupCategories, null, 2));

    await prisma.master.deleteMany({});
    await prisma.masterCategory.deleteMany({});

    const categoryA = await prisma.masterCategory.create({ data: { name: CATEGORY_A_NAME } });
    categoryAId = categoryA.id;
    const categoryB = await prisma.masterCategory.create({ data: { name: CATEGORY_B_NAME } });
    categoryBId = categoryB.id;

    await prisma.master.create({
      data: { categoryId: categoryAId, code: "AB01", content: "AB検索確認用マスタ" },
    });
    await prisma.master.createMany({
      data: Array.from({ length: CATEGORY_A_MASTER_COUNT - 1 }, (_, i) => ({
        categoryId: categoryAId,
        code: `M${String(i + 1).padStart(2, "0")}`,
        content: `検索確認用内容${String(i + 1).padStart(2, "0")}`,
      })),
    });
    await prisma.master.createMany({
      data: Array.from({ length: CATEGORY_B_MASTER_COUNT }, (_, i) => ({
        categoryId: categoryBId,
        code: `N${String(i + 1).padStart(2, "0")}`,
        content: `分類B確認用内容${String(i + 1).padStart(2, "0")}`,
      })),
    });
  });

  test.afterAll(async () => {
    const after = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify(
        after.map((c) => ({ name: c.name, masters: c.masters })),
        null,
        2,
      ),
    );

    // テストで作成したデータを消し、元々あった分類・マスタを同内容で復元する（idは採番し直しのため変わる）
    await prisma.master.deleteMany({});
    await prisma.masterCategory.deleteMany({});
    for (const category of backupCategories) {
      const created = await prisma.masterCategory.create({ data: { name: category.name } });
      if (category.masters.length > 0) {
        await prisma.master.createMany({
          data: category.masters.map((m) => ({
            categoryId: created.id,
            code: m.code,
            content: m.content,
          })),
        });
      }
    }
    await prisma.$disconnect();
  });

  test("TC-001 初期表示", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");

    await expect(page.getByRole("heading", { name: "マスタ管理" })).toBeVisible();
    await expect(page.getByText("検索条件", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "マスタ分類" })).toContainText(CATEGORY_A_NAME);
    await expect(page.getByText(`検索結果 全${CATEGORY_A_MASTER_COUNT}件（1 / `)).toBeVisible();
    await page.screenshot({ path: evidence("001_マスタ一覧初期表示.png"), fullPage: true });
  });

  test("TC-002 マスタ分類とマスタ文字列のAND検索", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master?categoryId=${categoryAId}&keyword=AB`);

    await expect(page.getByText("検索結果 全1件（1 / 1ページ）")).toBeVisible();
    await expect(page.getByText("AB01", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_分類とキーワードのAND検索.png"), fullPage: true });
  });

  test("TC-003 キーワードの部分一致・大文字小文字無視・前後空白除去", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");
    await page.getByLabel("マスタ文字列").fill(" ab ");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page).toHaveURL(/keyword=ab/);
    await expect(page.getByText("AB01", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("003_キーワード部分一致確認.png"), fullPage: true });
  });

  test("TC-004 「すべて」を選択した検索", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master?categoryId=all");

    const total = CATEGORY_A_MASTER_COUNT + CATEGORY_B_MASTER_COUNT;
    await expect(page.getByText(`検索結果 全${total}件（1 / `)).toBeVisible();
    await page.screenshot({ path: evidence("004_すべて検索.png"), fullPage: true });
  });

  test("TC-005 検索結果0件", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");
    await page.getByLabel("マスタ文字列").fill("ZZZZZZZZ");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByText("該当するマスタがありません")).toBeVisible();
    await expect(page.getByText("検索結果 全0件（1 / 1ページ）")).toBeVisible();
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "次へ" })).toBeDisabled();
    await page.screenshot({ path: evidence("005_検索結果0件.png"), fullPage: true });
  });

  test("TC-006 並び替え見出しの操作", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master?categoryId=${categoryAId}`);

    await page.getByRole("link", { name: "マスタコードを昇順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=code&order=asc/);
    await page.screenshot({ path: evidence("006_ソート切替_昇順.png"), fullPage: true });

    await page.getByRole("link", { name: "マスタコードを降順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=code&order=desc/);
    await page.screenshot({ path: evidence("006_ソート切替_降順.png"), fullPage: true });
  });

  test("TC-007 ページング", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master?categoryId=${categoryAId}`);

    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "次へ" })).toBeVisible();
    await page.screenshot({ path: evidence("007_ページング確認_1ページ目.png"), fullPage: true });

    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText(`（2 / `)).toBeVisible();
    await expect(page.getByRole("link", { name: "前へ" })).toBeVisible();
    await page.screenshot({ path: evidence("007_ページング確認_2ページ目.png"), fullPage: true });
  });

  test("TC-008 検索条件の開閉", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");

    const categorySelect = page.getByRole("combobox", { name: "マスタ分類" });
    await categorySelect.click();
    await page.getByRole("option", { name: new RegExp(CATEGORY_B_NAME) }).click();
    await page.getByLabel("マスタ文字列").fill("開閉確認用キーワード");

    const toggleButton = page.getByRole("button", { name: "検索条件を閉じる" });
    await toggleButton.click();

    await expect(page.getByRole("combobox", { name: "マスタ分類" })).toHaveCount(0);
    const reopenButton = page.getByRole("button", { name: "検索条件を開く" });
    await expect(reopenButton).toHaveAttribute("aria-expanded", "false");
    await page.screenshot({ path: evidence("008_検索条件開閉_閉じた状態.png"), fullPage: true });

    await reopenButton.click();
    await expect(page.getByLabel("マスタ文字列")).toHaveValue("開閉確認用キーワード");
    await expect(page.getByRole("combobox", { name: "マスタ分類" })).toContainText(CATEGORY_B_NAME);
    await expect(page.getByRole("button", { name: "検索条件を閉じる" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await page.screenshot({ path: evidence("008_検索条件開閉_再表示後.png"), fullPage: true });
  });

  test("TC-009 「新規登録」ボタンの表示制御", async ({ browser }) => {
    const cases = [
      [ADMIN, true],
      [OPERATOR, true],
      [VIEWER, false],
    ] as const;

    for (const [user, expectVisible] of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user);
      await page.goto("/master");

      const newButton = page.getByRole("link", { name: "新規登録" });
      if (expectVisible) {
        await expect(newButton).toBeVisible();
      } else {
        await expect(newButton).toHaveCount(0);
      }
      await expect(page.getByRole("link", { name: "マスタ分類の管理" })).toBeVisible();
      await page.screenshot({
        path: evidence(`009_新規登録ボタン権限確認_${user.role}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });

  test("TC-010 CSVダウンロードボタンの非活性理由表示（0件時）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");
    await page.getByLabel("マスタ文字列").fill("ZZZZZZZZ");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByRole("button", { name: "CSVダウンロード" })).toBeDisabled();
    await expect(page.getByText("対象のデータがありません")).toBeVisible();
    await page.screenshot({ path: evidence("010_CSV非活性理由表示.png"), fullPage: true });
  });
});
