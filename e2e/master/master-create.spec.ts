import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_11_マスタ新規登録",
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

test.describe.serial("マスタ新規登録（MST-02 / MST-03）", () => {
  const categoryName = "新規登録確認分類";
  let categoryId: number;
  // テスト開始前の全分類・全マスタ。TC-012実行後にafterAllでこの内容に完全復元する。
  let originalBackup: { name: string; masters: { code: string; content: string }[] }[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const categories = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    originalBackup = categories.map((c) => ({ name: c.name, masters: c.masters }));
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify(originalBackup, null, 2));

    const category = await prisma.masterCategory.create({ data: { name: categoryName } });
    categoryId = category.id;
    await prisma.master.create({
      data: { categoryId, code: "DUP0001", content: "重複確認用マスタ" },
    });
  });

  test.afterAll(async () => {
    const afterCategories = await prisma.masterCategory.findMany({
      include: { masters: { select: { code: true, content: true } } },
      orderBy: { id: "asc" },
    });
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify(
        afterCategories.map((c) => ({ name: c.name, masters: c.masters })),
        null,
        2,
      ),
    );

    // テストで作成した分類・マスタをすべて消し、テスト開始前の状態を同内容で復元する（idは採番し直しのため変わる）
    await prisma.master.deleteMany({});
    await prisma.masterCategory.deleteMany({});
    for (const category of originalBackup) {
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

  test("TC-001 新規登録の完了（確認画面の表示項目を含む）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("NEWCODE1");
    await page.getByLabel("マスタ内容").fill("新規登録確認内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText("新規登録", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後のマスタ分類")).toBeVisible();
    await expect(page.getByText("登録後のマスタコード")).toBeVisible();
    await expect(page.getByText("NEWCODE1", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後のマスタ内容")).toBeVisible();
    await expect(page.getByText("新規登録確認内容", { exact: true })).toBeVisible();
    await expect(page.getByText("変更前のマスタ分類")).toHaveCount(0);
    await page.screenshot({ path: evidence("001_新規登録確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/master\/\d+\?created=1/);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("001_新規登録完了後詳細画面.png"), fullPage: true });
  });

  test("TC-002 マスタ分類未選択での確認", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await page.getByLabel("マスタコード").fill("NOCATEG1");
    await page.getByLabel("マスタ内容").fill("分類未選択確認内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ分類を選択してください")).toBeVisible();
    await page.screenshot({ path: evidence("002_分類未選択エラー.png"), fullPage: true });
  });

  test("TC-003 確認画面遷移時のコード重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("DUP0001");
    await page.getByLabel("マスタ内容").fill("重複確認内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText("同じマスタ分類に同じマスタコードが登録されています"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("003_確認画面遷移時重複エラー.png"), fullPage: true });
  });

  test("TC-004 実行時点のコード重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("DUP0002");
    await page.getByLabel("マスタ内容").fill("実行時重複確認内容");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await prisma.master.create({
      data: { categoryId, code: "DUP0002", content: "先行登録済みマスタ" },
    });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText("同じマスタ分類に同じマスタコードが登録されています"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_実行時重複エラー.png"), fullPage: true });

    const count = await prisma.master.count({ where: { categoryId, code: "DUP0002" } });
    expect(count).toBe(1);
  });

  test("TC-005 マスタコード8文字での登録", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("ABCDEFG1");
    await page.getByLabel("マスタ内容").fill("8文字コード確認内容");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page).toHaveURL(/\/master\/\d+\?created=1/);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("005_コード8文字登録成功.png"), fullPage: true });
  });

  test("TC-006 マスタコード9文字での登録拒否", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    const codeInput = page.getByLabel("マスタコード");
    // input[maxlength=8]により9文字目の入力がブラウザ側でブロックされるため、
    // maxlength属性を外してからサーバー側の文字数チェックを確認する
    await codeInput.evaluate((el) => el.removeAttribute("maxlength"));
    await codeInput.fill("ABCDEFG12");
    await page.getByLabel("マスタ内容").fill("9文字コード確認内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタコードは8文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("006_コード9文字登録拒否.png"), fullPage: true });
  });

  test("TC-007 マスタコードの形式エラー", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("abc123");
    await page.getByLabel("マスタ内容").fill("形式エラー確認内容");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText(
        "マスタコードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("007_コード形式エラー.png"), fullPage: true });
  });

  test("TC-008 マスタ内容30文字／31文字での登録", async ({ page }) => {
    const content30 = "お".repeat(30);
    const content31 = "か".repeat(31);

    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("CONTENT3");
    await page.getByLabel("マスタ内容").fill(content30);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/master\/\d+\?created=1/);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("008_内容30文字登録成功.png"), fullPage: true });

    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("CONTENT4");
    await page.getByLabel("マスタ内容").fill(content31);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ内容は30文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("008_内容31文字登録拒否.png"), fullPage: true });
  });

  test("TC-009 「入力内容を修正」での入力値保持", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("EDITCHK1");
    await page.getByLabel("マスタ内容").fill("修正確認内容");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("マスタコード")).toHaveValue("EDITCHK1");
    await expect(page.getByLabel("マスタ内容")).toHaveValue("修正確認内容");
    await expect(page.getByRole("combobox", { name: "マスタ分類" })).toContainText(categoryName);
    await page.screenshot({ path: evidence("009_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-010 「キャンセル」での破棄", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/new");
    await selectCategory(page, categoryName);
    await page.getByLabel("マスタコード").fill("CANCEL01");
    await page.getByLabel("マスタ内容").fill("キャンセル確認内容");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL("http://localhost:3000/master");
    const count = await prisma.master.count({ where: { categoryId, code: "CANCEL01" } });
    expect(count).toBe(0);
    await page.screenshot({ path: evidence("010_キャンセルで破棄.png"), fullPage: true });
  });

  test("TC-011 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/master/new");

    await expect(page).toHaveURL("http://localhost:3000/master");
    await page.screenshot({ path: evidence("011_VIEWER権限制御.png"), fullPage: true });
  });

  test("TC-012 マスタ分類0件時の案内表示", async ({ page }) => {
    // 分類0件の状態を一時的に作る。このテストが最後のケースのため、復元は行わずafterAllにまとめて任せる。
    await prisma.master.deleteMany({});
    await prisma.masterCategory.deleteMany({});

    await login(page, ADMIN);
    await page.goto("/master/new");
    await expect(
      page.getByText("マスタ分類が登録されていません。先にマスタ分類を登録してください。"),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "マスタ分類を登録する" })).toBeVisible();
    await expect(page.getByRole("button", { name: "確認する" })).toBeDisabled();
    await page.screenshot({ path: evidence("012_分類0件時案内表示.png"), fullPage: true });
  });
});
