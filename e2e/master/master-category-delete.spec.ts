import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_24_マスタ分類削除",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  role: "ADMIN",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
};

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe.serial("マスタ分類削除（MST-07 削除確認ダイアログ）", () => {
  const createdNames: string[] = [];

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
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

    await prisma.master.deleteMany({
      where: { category: { name: { in: createdNames } } },
    });
    await prisma.masterCategory.deleteMany({ where: { name: { in: createdNames } } });
    await prisma.$disconnect();
  });

  test("TC-001 配下マスタ0件の分類削除完了", async ({ page }) => {
    const name = "削除対象分類（空）";
    const category = await prisma.masterCategory.create({ data: { name } });

    await login(page, ADMIN);
    await page.goto(`/master/categories/${category.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(page).toHaveURL(/\/master\/categories(\?deleted=1)?$/);
    await expect(page.getByText("削除しました").first()).toBeVisible();
    await expect(page.getByText(name)).toHaveCount(0);
    await page.screenshot({ path: evidence("001_削除完了.png"), fullPage: true });

    const remaining = await prisma.masterCategory.findUnique({ where: { id: category.id } });
    expect(remaining).toBeNull();
  });

  test("TC-002 配下にマスタが残っている分類の削除拒否", async ({ page }) => {
    const name = "削除対象分類（マスタあり）";
    createdNames.push(name);
    const category = await prisma.masterCategory.create({ data: { name } });
    await prisma.master.create({
      data: { categoryId: category.id, code: "DELTEST1", content: "削除拒否確認用マスタ" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/categories/${category.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await page.getByRole("button", { name: "削除する" }).click();

    await expect(
      page.getByText(
        "配下にマスタが登録されているため削除できません。先に配下のマスタを削除してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("002_配下マスタあり削除拒否.png"), fullPage: true });

    const remaining = await prisma.masterCategory.findUnique({ where: { id: category.id } });
    expect(remaining).not.toBeNull();
  });

  test("TC-003 同時更新エラー", async ({ page }) => {
    const name = "削除対象分類（同時更新確認）";
    createdNames.push(name);
    const category = await prisma.masterCategory.create({ data: { name } });

    await login(page, ADMIN);
    await page.goto(`/master/categories/${category.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // ダイアログを表示したまま、他の利用者が先に更新した状況をDB操作で再現する
    await prisma.masterCategory.update({
      where: { id: category.id },
      data: { name: "先行更新済み分類（削除）" },
    });

    await page.getByRole("button", { name: "削除する" }).click();
    await expect(
      page.getByText(
        "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("003_同時更新エラー.png"), fullPage: true });

    const remaining = await prisma.masterCategory.findUnique({ where: { id: category.id } });
    expect(remaining).not.toBeNull();
    createdNames.push("先行更新済み分類（削除）");
  });

  test("TC-004 削除確認ダイアログの表示項目", async ({ page }) => {
    const name = "削除ダイアログ表示確認分類";
    createdNames.push(name);
    const category = await prisma.masterCategory.create({ data: { name } });
    const code = String(category.id).padStart(4, "0");

    await login(page, ADMIN);
    await page.goto(`/master/categories/${category.id}`);
    await page.getByRole("button", { name: "削除" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "マスタ分類を削除しますか？" })).toBeVisible();
    await expect(dialog.getByText(code, { exact: true })).toBeVisible();
    await expect(dialog.getByText(name, { exact: true })).toBeVisible();
    await expect(dialog.getByText("削除したマスタ分類は元に戻せません。")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "削除する" })).toBeVisible();
    await page.screenshot({ path: evidence("004_削除ダイアログ表示項目.png"), fullPage: true });
  });

  test("TC-005 「キャンセル」でのダイアログを閉じる動作", async ({ page }) => {
    const name = "削除キャンセル確認分類";
    createdNames.push(name);
    const category = await prisma.masterCategory.create({ data: { name } });

    await login(page, ADMIN);
    await page.goto(`/master/categories/${category.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("button", { name: "キャンセル" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${category.id}`);
    await page.screenshot({
      path: evidence("005_キャンセルでダイアログを閉じる.png"),
      fullPage: true,
    });

    const remaining = await prisma.masterCategory.findUnique({ where: { id: category.id } });
    expect(remaining).not.toBeNull();
  });
});
