import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(process.cwd(), "docs/test/unit/result/master/テスト結果UT_14_マスタ削除");

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

test.describe.serial("マスタ削除（MST-04 削除確認ダイアログ）", () => {
  let categoryId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    const category = await prisma.masterCategory.create({ data: { name: "削除確認用分類" } });
    categoryId = category.id;

    fs.writeFileSync(evidence("db_before.json"), JSON.stringify({ categoryId }, null, 2));
  });

  test.afterAll(async () => {
    fs.writeFileSync(evidence("db_after.json"), JSON.stringify({ categoryId }, null, 2));

    await prisma.master.deleteMany({ where: { categoryId } });
    await prisma.masterCategory.delete({ where: { id: categoryId } });
    await prisma.$disconnect();
  });

  test("TC-001 マスタ削除の完了", async ({ page }) => {
    const master = await prisma.master.create({
      data: { categoryId, code: "DEL0001", content: "削除確認用内容" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/${master.id}`);
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();

    await expect(page).toHaveURL(/\/master(\?.*deleted=1)?$/);
    await expect(page.getByText("削除しました").first()).toBeVisible();
    await expect(page.getByText("DEL0001", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: evidence("001_削除完了.png"), fullPage: true });

    const remaining = await prisma.master.findUnique({ where: { id: master.id } });
    expect(remaining).toBeNull();
  });

  test("TC-002 同時更新エラー", async ({ page }) => {
    const master = await prisma.master.create({
      data: { categoryId, code: "DEL0002", content: "同時更新確認内容" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/${master.id}`);
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // ダイアログを表示したまま、他の利用者が先に更新した状況をDB操作で再現する
    await prisma.master.update({
      where: { id: master.id },
      data: { content: "先行更新済み内容" },
    });

    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(
      page.getByText(
        "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("002_同時更新エラー.png"), fullPage: true });

    const remaining = await prisma.master.findUnique({ where: { id: master.id } });
    expect(remaining).not.toBeNull();
    expect(remaining?.content).toBe("先行更新済み内容");
  });

  test("TC-003 確認ダイアログ表示後に対象がすでに削除されている場合", async ({ page }) => {
    const master = await prisma.master.create({
      data: { categoryId, code: "DEL0003", content: "対象なし確認内容" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/${master.id}`);
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // ダイアログを表示したまま、他の利用者が先に削除した状況をDB操作で再現する
    await prisma.master.delete({ where: { id: master.id } });

    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("対象のマスタが見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("003_対象なしエラー.png"), fullPage: true });
  });

  test("TC-004 削除確認ダイアログの表示項目", async ({ page }) => {
    const master = await prisma.master.create({
      data: { categoryId, code: "DEL0004", content: "表示確認内容" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/${master.id}`);
    await page.getByRole("button", { name: "削除する" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "マスタを削除しますか？" })).toBeVisible();
    await expect(dialog.getByText("削除確認用分類", { exact: true })).toBeVisible();
    await expect(dialog.getByText("DEL0004", { exact: true })).toBeVisible();
    await expect(dialog.getByText("表示確認内容", { exact: true })).toBeVisible();
    await expect(dialog.getByText("削除したマスタは元に戻せません。")).toBeVisible();
    await expect(
      dialog.getByText("このマスタを参照している画面では「未設定」として表示されます。"),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "削除する" })).toBeVisible();
    await page.screenshot({ path: evidence("004_削除ダイアログ表示項目.png"), fullPage: true });

    await prisma.master.delete({ where: { id: master.id } });
  });

  test("TC-005 「キャンセル」でのダイアログを閉じる動作", async ({ page }) => {
    const master = await prisma.master.create({
      data: { categoryId, code: "DEL0005", content: "キャンセル確認内容" },
    });

    await login(page, ADMIN);
    await page.goto(`/master/${master.id}`);
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    await page.getByRole("alertdialog").getByRole("button", { name: "キャンセル" }).click();

    await expect(page.getByRole("alertdialog")).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/master/${master.id}(\\?|$)`));
    await page.screenshot({
      path: evidence("005_キャンセルでダイアログを閉じる.png"),
      fullPage: true,
    });

    const remaining = await prisma.master.findUnique({ where: { id: master.id } });
    expect(remaining).not.toBeNull();

    await prisma.master.delete({ where: { id: master.id } });
  });
});
