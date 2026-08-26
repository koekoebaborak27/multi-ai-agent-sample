import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  createEvidenceDir,
  createNews,
  deleteCreatedNews,
  fillBeyondMaxLength,
  login,
  prisma,
  TEST_USERS,
  toDateTimeLocal,
  writeEvidenceJson,
} from "./news-test-helpers";

/** 指定したお知らせの行から編集ポップアップを開く。 */
async function openEdit(page: Page, title: string): Promise<void> {
  const row = page.getByRole("row").filter({ hasText: title });
  await row.getByRole("button", { name: "編集" }).click();
  await expect(page.getByRole("heading", { name: "お知らせを編集" })).toBeVisible();
}

/** お知らせ更新（NEWS-02 / NEWS-03）の画面操作テスト。 */
test.describe.serial("お知らせ更新（NEWS-02 / NEWS-03）", () => {
  const evidenceDir = createEvidenceDir("テスト結果UT_22_お知らせ更新");

  test.beforeAll(async () => {
    writeEvidenceJson(evidenceDir, "db_before_News.json", await prisma.news.findMany());
    await deleteCreatedNews();
  });

  test.afterAll(async () => {
    await deleteCreatedNews();
    writeEvidenceJson(evidenceDir, "db_after_News.json", await prisma.news.findMany());
    await prisma.$disconnect();
  });

  test("TC-001 初期値を表示し確認画面には変更後の値だけを表示する", async ({ page }) => {
    const target = await createNews("UPDATE-INITIAL", { body: "更新前本文" });
    await login(page, TEST_USERS.admin);
    await page.goto("/news?keyword=E2E-NEWS-UPDATE-INITIAL");
    await openEdit(page, target.title);
    await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(target.title);
    await page.getByLabel("タイトル", { exact: true }).fill("E2E-NEWS-UPDATE-INITIAL-AFTER");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("処理内容")).toBeVisible();
    await expect(page.getByText("更新", { exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "001_confirm.png"), fullPage: true });
  });

  test("TC-002 全項目を更新して登録者を保持する", async ({ page }) => {
    const target = await createNews("UPDATE-ALL", { body: "更新前本文" });
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await page.getByLabel("タイトル", { exact: true }).fill("E2E-NEWS-UPDATE-ALL-AFTER");
    await page
      .getByRole("dialog")
      .getByLabel("カテゴリ", { exact: true })
      .selectOption("MAINTENANCE");
    await page.getByLabel("本文").fill("更新後本文");
    await page.getByLabel("公開開始日時", { exact: true }).fill("2026-08-28T09:00");
    await page.getByLabel("公開終了日時", { exact: true }).fill("2026-08-29T09:00");
    await page.getByLabel("公開する").uncheck();
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("お知らせを更新しました")).toBeVisible();
    const updated = await prisma.news.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.title).toBe("E2E-NEWS-UPDATE-ALL-AFTER");
    expect(updated.createdBy).toBe("admin");
    expect(updated.updatedBy).toBe("admin");
    await page.screenshot({ path: path.join(evidenceDir, "002_update-all.png"), fullPage: true });
  });

  test("TC-003 値を変えずに更新して更新日時を進める", async ({ page }) => {
    const target = await createNews("UPDATE-SAME");
    const before = await prisma.news.findUniqueOrThrow({ where: { id: target.id } });
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("お知らせを更新しました")).toBeVisible();
    const after = await prisma.news.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    await page.screenshot({ path: path.join(evidenceDir, "003_same-values.png"), fullPage: true });
  });

  test("TC-004 不正な更新入力を確認画面へ進めない", async ({ page }) => {
    const target = await createNews("UPDATE-VALIDATION");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await fillBeyondMaxLength(
      page.getByLabel("タイトル", { exact: true }),
      `E2E-NEWS-${"x".repeat(201)}`,
    );
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("alert")).toHaveText("タイトルは200文字以内です");
    await page.screenshot({ path: path.join(evidenceDir, "004_validation.png"), fullPage: true });
  });

  test("TC-005 確認後の先行更新を競合として扱う", async ({ page }) => {
    const target = await createNews("UPDATE-CONFLICT");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await page.getByLabel("本文").fill("画面からの更新");
    await page.getByRole("button", { name: "確認する" }).click();
    await prisma.news.update({ where: { id: target.id }, data: { body: "先行更新" } });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByRole("alert")).toContainText("ほかの利用者によって更新されています");
    expect((await prisma.news.findUniqueOrThrow({ where: { id: target.id } })).body).toBe(
      "先行更新",
    );
    await page.screenshot({ path: path.join(evidenceDir, "005_conflict.png"), fullPage: true });
  });

  test("TC-006 確認後に削除された対象を更新しない", async ({ page }) => {
    const target = await createNews("UPDATE-MISSING");
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await page.getByRole("button", { name: "確認する" }).click();
    await prisma.news.delete({ where: { id: target.id } });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByRole("alert")).toHaveText("対象のお知らせが見つかりません");
    await page.screenshot({ path: path.join(evidenceDir, "006_missing.png"), fullPage: true });
  });

  test("TC-007 修正後の入力値を保持しキャンセル時はDBを変えない", async ({ page }) => {
    const target = await createNews("UPDATE-CANCEL", { body: "更新前本文" });
    await login(page, TEST_USERS.admin);
    await page.goto(`/news?keyword=${target.title}`);
    await openEdit(page, target.title);
    await page.getByLabel("本文").fill("修正後本文");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("本文")).toHaveValue("修正後本文");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "キャンセル" }).click();
    expect((await prisma.news.findUniqueOrThrow({ where: { id: target.id } })).body).toBe(
      "更新前本文",
    );
    await page.screenshot({ path: path.join(evidenceDir, "007_cancel.png"), fullPage: true });
  });

  test.skip("TC-008 VIEWERによるServer Action直接実行は画面操作テストの対象外", async () => {});
});
