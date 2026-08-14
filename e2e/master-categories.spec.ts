import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/テスト結果UT_20_マスタ分類一覧",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

// テスト用アカウント。値そのものはコードに書かず環境変数（無ければseed.tsと同じ既定値）から読む。
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

// ページング確認用に一時作成する分類名の接頭辞
const PAGING_PREFIX = "E2Eテスト分類";

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe.serial("マスタ分類一覧（MST-06）", () => {
  // テスト前の既存データ。TC-005実行後に同内容で復元するために保持する。
  let backupCategories: { name: string; masters: { code: string; content: string }[] }[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const categories = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    backupCategories = categories.map((c) => ({ name: c.name, masters: c.masters }));

    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "db_before_MasterCategory.json"),
      JSON.stringify(backupCategories, null, 2),
    );
  });

  test.afterAll(async () => {
    const after = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    fs.writeFileSync(
      path.join(EVIDENCE_DIR, "db_after_MasterCategory.json"),
      JSON.stringify(
        after.map((c) => ({ name: c.name, masters: c.masters })),
        null,
        2,
      ),
    );
    await prisma.$disconnect();
  });

  test("TC-001 初期表示", async ({ page }) => {
    await login(page, ADMIN);
    const total = await prisma.masterCategory.count();

    await page.goto("/master/categories");
    await expect(page.getByRole("heading", { name: "マスタ分類一覧" })).toBeVisible();
    await expect(page.getByText(`全${total}件（1 / `)).toBeVisible();
    await page.screenshot({ path: evidence("001_マスタ分類一覧初期表示.png"), fullPage: true });
  });

  test("TC-002 詳細リンクでの画面遷移", async ({ page }) => {
    await login(page, ADMIN);
    const firstCategory = await prisma.masterCategory.findFirstOrThrow({ orderBy: { id: "asc" } });

    await page.goto("/master/categories");
    await page.getByRole("link", { name: "詳細" }).first().click();
    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${firstCategory.id}`);
    await page.screenshot({ path: evidence("002_詳細リンク遷移.png"), fullPage: true });
  });

  test("TC-003 並び替え見出しの操作（分類コード）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/categories");

    await page.getByRole("link", { name: "マスタ分類コードを降順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=code&order=desc/);
    await page.screenshot({ path: evidence("003_ソート切替_分類コード_降順.png"), fullPage: true });

    await page.getByRole("link", { name: "マスタ分類コードを昇順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=code&order=asc/);
    await page.screenshot({ path: evidence("003_ソート切替_分類コード_昇順.png"), fullPage: true });
  });

  test("TC-004 並び替え見出しの操作（分類名・登録マスタ件数）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/categories");

    await page.getByRole("link", { name: "マスタ分類名を昇順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=name&order=asc/);
    await page.screenshot({ path: evidence("004_ソート切替_分類名.png"), fullPage: true });

    await page.getByRole("link", { name: "登録マスタ件数を昇順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=masterCount&order=asc/);
    await page.screenshot({ path: evidence("004_ソート切替_登録マスタ件数.png"), fullPage: true });
  });

  test("TC-006 ページング", async ({ page }) => {
    // 既存分類（3件）に加え、31件以上になるよう分類を一時追加する
    await prisma.masterCategory.createMany({
      data: Array.from({ length: 28 }, (_, i) => ({
        name: `${PAGING_PREFIX}${String(i + 1).padStart(2, "0")}`,
      })),
    });

    await login(page, ADMIN);
    await page.goto("/master/categories?sort=code&order=asc");
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await expect(page.getByRole("link", { name: "次へ" })).toBeVisible();
    await page.screenshot({ path: evidence("006_ページング確認_1ページ目.png"), fullPage: true });

    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("（2 / ")).toBeVisible();
    await expect(page.getByRole("link", { name: "前へ" })).toBeVisible();
    await page.screenshot({ path: evidence("006_ページング確認_2ページ目.png"), fullPage: true });

    // TC-005を実行しない単独実行でもゴミが残らないよう、このテストで追加した分は自分で消す
    await prisma.masterCategory.deleteMany({ where: { name: { startsWith: PAGING_PREFIX } } });
  });

  test("TC-005 / TC-008 マスタ分類0件時の表示", async ({ page }) => {
    // 一時的に全マスタ分類（TC-006で追加した分を含む）を削除し、0件状態を作る
    await prisma.master.deleteMany({});
    await prisma.masterCategory.deleteMany({});

    await login(page, ADMIN);
    await page.goto("/master/categories");
    await expect(page.getByText("登録されているマスタ分類がありません")).toBeVisible();
    await expect(page.getByText("全0件（1 / 1ページ）")).toBeVisible();
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "次へ" })).toBeDisabled();
    await page.screenshot({ path: evidence("005_マスタ分類0件表示.png"), fullPage: true });

    await expect(page.getByText("対象のデータがありません")).toBeVisible();
    await page.screenshot({ path: evidence("008_CSV非活性理由表示_0件.png"), fullPage: true });

    // 元のマスタ分類・マスタを同内容で復元する（idは採番し直しのため変わる）
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
  });

  test("TC-007 「新規登録」ボタンの表示制御", async ({ browser }) => {
    const cases = [
      [ADMIN, true],
      [OPERATOR, true],
      [VIEWER, false],
    ] as const;

    // ロールごとにセッションを分けるため、ブラウザコンテキストを都度作り直す
    for (const [user, expectVisible] of cases) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user);
      await page.goto("/master/categories");

      const newButton = page.getByRole("link", { name: "新規登録" });
      if (expectVisible) {
        await expect(newButton).toBeVisible();
      } else {
        await expect(newButton).toHaveCount(0);
      }
      await expect(page.getByRole("link", { name: "マスタ一覧へ戻る" })).toBeVisible();
      await page.screenshot({
        path: evidence(`007_新規登録ボタン権限確認_${user.role}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });
});
