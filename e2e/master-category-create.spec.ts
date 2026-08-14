import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/テスト結果UT_22_マスタ分類新規登録",
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

test.describe.serial("マスタ分類新規登録（MST-08 / MST-09）", () => {
  const duplicateName = "分類名重複確認用";
  const createdNames: string[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    // TC-002/TC-003で使う重複確認用の分類を用意する
    await prisma.masterCategory.create({ data: { name: duplicateName } });

    const before = await prisma.masterCategory.findMany({ orderBy: { id: "asc" } });
    fs.writeFileSync(
      evidence("db_before_MasterCategory.json"),
      JSON.stringify(
        before.map((c) => ({ name: c.name })),
        null,
        2,
      ),
    );
  });

  test.afterAll(async () => {
    const after = await prisma.masterCategory.findMany({ orderBy: { id: "asc" } });
    fs.writeFileSync(
      evidence("db_after_MasterCategory.json"),
      JSON.stringify(
        after.map((c) => ({ name: c.name })),
        null,
        2,
      ),
    );

    // テストで作成した分類を後片付けする（重複確認用と各テストケースで登録した分類）
    await prisma.masterCategory.deleteMany({
      where: { name: { in: [duplicateName, ...createdNames] } },
    });
    await prisma.$disconnect();
  });

  test("TC-001 新規登録の完了（前後空白の除去を含む）", async ({ page }) => {
    const rawName = " 空白除去確認分類 ";
    const trimmedName = "空白除去確認分類";
    createdNames.push(trimmedName);

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(rawName);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText("登録後のマスタ分類名")).toBeVisible();
    await expect(page.getByText(trimmedName, { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("001_新規登録_確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/master\/categories\/\d+\?created=1/);
    await expect(page.getByText("登録しました")).toBeVisible();
    await expect(page.getByText(trimmedName, { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("001_新規登録_完了後詳細画面.png"), fullPage: true });
  });

  test("TC-002 確認画面遷移時の名称重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(duplicateName);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("同じ名前のマスタ分類が登録されています")).toBeVisible();
    await page.screenshot({ path: evidence("002_確認画面遷移時重複エラー.png"), fullPage: true });
  });

  test("TC-003 実行時点の名称重複", async ({ page }) => {
    const name = "実行時重複確認分類";

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    // 確認画面を表示したまま、他の利用者が先に同じ名前で登録した状況をDB操作で再現する
    await prisma.masterCategory.create({ data: { name } });
    createdNames.push(name);

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("同じ名前のマスタ分類が登録されています")).toBeVisible();
    await page.screenshot({ path: evidence("003_実行時重複エラー.png"), fullPage: true });

    const count = await prisma.masterCategory.count({ where: { name } });
    expect(count).toBe(1);
  });

  test("TC-004 分類名30文字での登録", async ({ page }) => {
    const name = "あ".repeat(30);
    createdNames.push(name);

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page).toHaveURL(/\/master\/categories\/\d+\?created=1/);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("004_30文字登録成功.png"), fullPage: true });
  });

  test("TC-005 分類名31文字での登録拒否", async ({ page }) => {
    const name = "い".repeat(31);

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ分類名は30文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("005_31文字登録拒否.png"), fullPage: true });
  });

  test("TC-006 分類名未入力での確認", async ({ page }) => {
    // input[required]属性によりブラウザの標準検証が空文字の送信をブロックするため、
    // 空白のみを入力してブラウザの検証を通過させ、サーバー側のtrim後必須チェックを確認する
    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill("   ");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ分類名は必須です")).toBeVisible();
    await page.screenshot({ path: evidence("006_未入力エラー.png"), fullPage: true });
  });

  test("TC-007 確認画面の表示項目（新規登録モード）", async ({ page }) => {
    const name = "表示確認分類";
    createdNames.push(name);

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByText("処理内容")).toBeVisible();
    await expect(page.getByText("新規登録", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後のマスタ分類名")).toBeVisible();
    await expect(page.getByText("マスタ分類コード")).toHaveCount(0);
    await expect(page.getByText("現在のマスタ分類名")).toHaveCount(0);
    await expect(page.getByText("登録マスタ件数")).toHaveCount(0);
    await page.screenshot({ path: evidence("007_確認画面表示項目.png"), fullPage: true });
  });

  test("TC-008 「入力内容を修正」での入力値保持", async ({ page }) => {
    const name = "修正確認分類";

    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("マスタ分類名")).toHaveValue(name);
    await page.screenshot({ path: evidence("008_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-009 「キャンセル」での破棄", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/categories/new");
    await page.getByLabel("マスタ分類名").fill("キャンセル確認分類");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL("http://localhost:3000/master/categories");
    const count = await prisma.masterCategory.count({ where: { name: "キャンセル確認分類" } });
    expect(count).toBe(0);
    await page.screenshot({ path: evidence("009_キャンセルで破棄.png"), fullPage: true });
  });

  test("TC-010 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/master/categories/new");

    await expect(page).toHaveURL("http://localhost:3000/master/categories");
    await page.screenshot({ path: evidence("010_VIEWER権限制御.png"), fullPage: true });
  });
});
