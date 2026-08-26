import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import {
  createEvidenceDir,
  deleteCreatedNews,
  fillBeyondMaxLength,
  login,
  prisma,
  TEST_USERS,
  writeEvidenceJson,
} from "./news-test-helpers";

/** 登録ポップアップを開き、必須項目を入力する。 */
async function fillCreateForm(page: Page, title: string, body = "登録する本文"): Promise<void> {
  await page.getByRole("button", { name: "新規登録" }).click();
  await page.getByLabel("タイトル", { exact: true }).fill(title);
  await page.getByRole("dialog").getByLabel("カテゴリ", { exact: true }).selectOption("INCIDENT");
  await page.getByLabel("本文").fill(body);
}

/** お知らせ登録（NEWS-02 / NEWS-03）の画面操作テスト。 */
test.describe.serial("お知らせ登録（NEWS-02 / NEWS-03）", () => {
  const evidenceDir = createEvidenceDir("テスト結果UT_21_お知らせ登録");

  test.beforeAll(async () => {
    writeEvidenceJson(evidenceDir, "db_before_News.json", await prisma.news.findMany());
    await deleteCreatedNews();
  });

  test.afterAll(async () => {
    await deleteCreatedNews();
    writeEvidenceJson(evidenceDir, "db_after_News.json", await prisma.news.findMany());
    await prisma.$disconnect();
  });

  test("TC-001 全項目を確認して登録する", async ({ page }) => {
    const title = "E2E-NEWS-CREATE-001";
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, title, "1行目\n2行目");
    await page.getByLabel("公開開始日時", { exact: true }).fill("2026-08-27T09:00");
    await page.getByLabel("公開終了日時", { exact: true }).fill("2026-08-28T09:00");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "001_confirm.png"), fullPage: true });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("お知らせを登録しました")).toBeVisible();
    await expect(page.getByText(title)).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "001_complete.png"), fullPage: true });
    expect(await prisma.news.count({ where: { title } })).toBe(1);
  });

  test("TC-002 任意項目を空欄・非公開で登録する", async ({ page }) => {
    const title = "E2E-NEWS-CREATE-OPTIONAL";
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, title);
    await page.getByLabel("公開する").uncheck();
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    // 実行の応答を待たずにDBを確認すると、登録の反映前に問い合わせてしまうため、
    // 登録完了トーストが出るまで待ってから確認する。
    await expect(page.getByText("お知らせを登録しました")).toBeVisible();
    const created = await prisma.news.findFirstOrThrow({ where: { title } });
    expect(created.startAt).toBeNull();
    expect(created.endAt).toBeNull();
    expect(created.published).toBe(false);
    await page.screenshot({ path: path.join(evidenceDir, "002_optional.png"), fullPage: true });
  });

  test("TC-003 確認画面から修正・キャンセルしても登録しない", async ({ page }) => {
    const title = "E2E-NEWS-CREATE-CANCEL";
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, title);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue(title);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "キャンセル" }).click();
    expect(await prisma.news.count({ where: { title } })).toBe(0);
    await page.screenshot({ path: path.join(evidenceDir, "003_cancel.png"), fullPage: true });
  });

  test("TC-004 空白だけのタイトルを拒否する", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, " ");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("alert")).toHaveText("タイトルは必須です");
    await page.screenshot({
      path: path.join(evidenceDir, "004_required-title.png"),
      fullPage: true,
    });
  });

  test("TC-005 カテゴリと本文の未入力をブラウザが示す", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await page.getByRole("button", { name: "新規登録" }).click();
    await page.getByLabel("タイトル", { exact: true }).fill("E2E-NEWS-CREATE-REQUIRED");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "お知らせを登録" })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "005_required-fields.png"),
      fullPage: true,
    });
  });

  test("TC-006 タイトル200文字は登録でき201文字は拒否する", async ({ page }) => {
    const allowed = `E2E-NEWS-${"a".repeat(191)}`;
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, allowed);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    // 実行の応答を待たずにDBを確認すると、登録の反映前に問い合わせてしまうため、
    // 登録完了トーストが出るまで待ってから確認する。
    await expect(page.getByText("お知らせを登録しました")).toBeVisible();
    expect(await prisma.news.count({ where: { title: allowed } })).toBe(1);
    await page.getByRole("button", { name: "新規登録" }).click();
    await fillBeyondMaxLength(
      page.getByLabel("タイトル", { exact: true }),
      `E2E-NEWS-${"b".repeat(192)}`,
    );
    await page.getByRole("dialog").getByLabel("カテゴリ", { exact: true }).selectOption("NEWS");
    await page.getByLabel("本文").fill("本文");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("alert")).toHaveText("タイトルは200文字以内です");
    await page.screenshot({ path: path.join(evidenceDir, "006_title-length.png"), fullPage: true });
  });

  test("TC-007 本文3000文字は登録でき3001文字は拒否する", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, "E2E-NEWS-CREATE-BODY-3000", "a".repeat(3000));
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await page.getByRole("button", { name: "新規登録" }).click();
    await page.getByLabel("タイトル", { exact: true }).fill("E2E-NEWS-CREATE-BODY-3001");
    await page.getByRole("dialog").getByLabel("カテゴリ", { exact: true }).selectOption("NEWS");
    await fillBeyondMaxLength(page.getByLabel("本文"), "a".repeat(3001));
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("alert")).toHaveText("本文は3000文字以内です");
    await page.screenshot({ path: path.join(evidenceDir, "007_body-length.png"), fullPage: true });
  });

  test("TC-008 逆転した公開期間を拒否し同時刻は登録する", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, "E2E-NEWS-CREATE-INVALID-PERIOD");
    await page.getByLabel("公開開始日時", { exact: true }).fill("2026-08-28T09:00");
    await page.getByLabel("公開終了日時", { exact: true }).fill("2026-08-27T09:00");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "公開終了日時は公開開始日時以降にしてください",
    );
    await page.screenshot({
      path: path.join(evidenceDir, "008_invalid-period.png"),
      fullPage: true,
    });
  });

  test("TC-009 閉じた登録ダイアログは入力値を残さない", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await fillCreateForm(page, "E2E-NEWS-CREATE-DISCARD");
    await page.getByRole("button", { name: "キャンセル" }).click();
    await page.getByRole("button", { name: "新規登録" }).click();
    await expect(page.getByLabel("タイトル", { exact: true })).toHaveValue("");
    await expect(page.getByLabel("公開する")).toBeChecked();
    await page.screenshot({ path: path.join(evidenceDir, "009_discard.png"), fullPage: true });
  });

  test("TC-010 OPERATORもお知らせを登録できる", async ({ page }) => {
    const title = "E2E-NEWS-CREATE-OPERATOR";
    await login(page, TEST_USERS.operator);
    await page.goto("/news");
    await fillCreateForm(page, title);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("お知らせを登録しました")).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "010_operator.png"), fullPage: true });
  });

  test.skip("TC-011 VIEWERによるServer Action直接実行は画面操作テストの対象外", async () => {});
});
