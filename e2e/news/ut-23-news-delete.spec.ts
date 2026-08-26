import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  createEvidenceDir,
  createNews,
  deleteCreatedNews,
  login,
  prisma,
  TEST_USERS,
  writeEvidenceJson,
} from "./news-test-helpers";

/** お知らせ削除（NEWS-02）の画面操作テスト。 */
test.describe.serial("お知らせ削除（NEWS-02）", () => {
  const evidenceDir = createEvidenceDir("テスト結果UT_23_お知らせ削除");

  test.beforeAll(async () => {
    writeEvidenceJson(evidenceDir, "db_before_News.json", await prisma.news.findMany());
    await deleteCreatedNews();
  });

  test.afterAll(async () => {
    await deleteCreatedNews();
    writeEvidenceJson(evidenceDir, "db_after_News.json", await prisma.news.findMany());
    await prisma.$disconnect();
  });

  test("TC-001 削除確認ダイアログを表示しキャンセルできる", async ({ page }) => {
    const target = await createNews("DELETE-CANCEL");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    const row = page.getByRole("row").filter({ hasText: target.title });
    await row.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("heading", { name: "お知らせを削除しますか？" })).toBeVisible();
    await expect(page.getByText("削除したお知らせは元に戻せません。")).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "001_dialog.png"), fullPage: true });
    await page.getByRole("button", { name: "キャンセル" }).click();
    expect(await prisma.news.count({ where: { id: target.id } })).toBe(1);
    await page.screenshot({ path: path.join(evidenceDir, "001_cancel.png"), fullPage: true });
  });

  test("TC-002 お知らせを物理削除し一覧とトップから消す", async ({ page }) => {
    const target = await createNews("DELETE-SUCCESS");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await page
      .getByRole("row")
      .filter({ hasText: target.title })
      .getByRole("button", { name: "削除" })
      .click();
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("お知らせを削除しました")).toBeVisible();
    expect(await prisma.news.count({ where: { id: target.id } })).toBe(0);
    await page.screenshot({
      path: path.join(evidenceDir, "002_list-complete.png"),
      fullPage: true,
    });
    await page.goto("/");
    await expect(page.getByText(target.title)).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDir, "002_top-complete.png"), fullPage: true });
  });

  test("TC-003 先行更新済みの行は削除しない", async ({ page }) => {
    const target = await createNews("DELETE-CONFLICT");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await page
      .getByRole("row")
      .filter({ hasText: target.title })
      .getByRole("button", { name: "削除" })
      .click();
    await prisma.news.update({ where: { id: target.id }, data: { body: "先行更新" } });
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alert")).toContainText("ほかの利用者によって更新されています");
    expect(await prisma.news.count({ where: { id: target.id } })).toBe(1);
    await page.screenshot({ path: path.join(evidenceDir, "003_conflict.png"), fullPage: true });
  });

  test("TC-004 確認後に削除済みの対象には対象なしエラーを表示する", async ({ page }) => {
    const target = await createNews("DELETE-MISSING");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await page
      .getByRole("row")
      .filter({ hasText: target.title })
      .getByRole("button", { name: "削除" })
      .click();
    await prisma.news.delete({ where: { id: target.id } });
    await page.getByRole("button", { name: "削除する" }).click();
    await expect(page.getByRole("alert")).toHaveText("対象のお知らせが見つかりません");
    await page.screenshot({ path: path.join(evidenceDir, "004_missing.png"), fullPage: true });
  });

  test.skip("TC-005 VIEWERによるServer Action直接実行は画面操作テストの対象外", async () => {});
});
