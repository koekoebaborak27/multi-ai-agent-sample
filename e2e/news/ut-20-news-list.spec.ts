import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  createEvidenceDir,
  createNews,
  deleteCreatedNews,
  login,
  NEWS_PAGE_SIZE,
  prisma,
  TEST_USERS,
  writeEvidenceJson,
} from "./news-test-helpers";

/** お知らせ管理一覧（NEWS-02）の画面操作テスト。 */
test.describe.serial("お知らせ管理一覧（NEWS-02）", () => {
  const evidenceDir = createEvidenceDir("テスト結果UT_20_お知らせ管理一覧");

  test.beforeAll(async () => {
    writeEvidenceJson(evidenceDir, "db_before_News.json", await prisma.news.findMany());
    await deleteCreatedNews();
  });

  test.afterAll(async () => {
    await deleteCreatedNews();
    writeEvidenceJson(evidenceDir, "db_after_News.json", await prisma.news.findMany());
    await prisma.$disconnect();
  });

  test("TC-001 ADMINの初期表示に検索・一覧・登録操作を表示する", async ({ page }) => {
    await createNews("LIST-EMPTY-DATE", { startAt: null, endAt: null });
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await expect(page.getByRole("heading", { name: "お知らせ管理" })).toBeVisible();
    await expect(page.getByLabel("カテゴリ", { exact: true })).toBeVisible();
    await expect(page.getByLabel("文言")).toBeVisible();
    await expect(page.getByRole("button", { name: "新規登録" })).toBeVisible();
    await expect(page.getByText("—", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "001_initial.png"), fullPage: true });
  });

  test("TC-002 公開ステータス4値を表示する", async ({ page }) => {
    await deleteCreatedNews();
    await createNews("LIST-PUBLISHED");
    await createNews("LIST-SCHEDULED", { startAt: new Date("2099-01-01T00:00:00Z") });
    await createNews("LIST-ENDED", { endAt: new Date("2000-01-01T00:00:00Z") });
    await createNews("LIST-UNPUBLISHED", { published: false });
    await login(page, TEST_USERS.admin);
    await page.goto("/news?keyword=E2E-NEWS-LIST-");
    for (const label of ["公開中", "公開前", "終了", "非公開中"])
      await expect(page.getByText(label, { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "002_publish-statuses.png"),
      fullPage: true,
    });
  });

  test("TC-003 カテゴリと文言のAND検索をURLへ反映する", async ({ page }) => {
    await deleteCreatedNews();
    await createNews("LIST-AND-AB01", { category: "INCIDENT" });
    await createNews("LIST-AND-ONLY-CATEGORY", { category: "INCIDENT" });
    await createNews("LIST-AND-ONLY-KEYWORD-AB01", { category: "NEWS" });
    await login(page, TEST_USERS.admin);
    await page.goto("/news?category=INCIDENT&keyword=AB01");
    await expect(page.getByText("E2E-NEWS-LIST-AND-AB01")).toBeVisible();
    await expect(page.getByText("E2E-NEWS-LIST-AND-ONLY-CATEGORY")).toHaveCount(0);
    await expect(page).toHaveURL(/category=INCIDENT&keyword=AB01/);
    await page.screenshot({ path: path.join(evidenceDir, "003_and-search.png"), fullPage: true });
  });

  test("TC-004 文言検索で前後空白を除き大文字小文字を区別しない", async ({ page }) => {
    await deleteCreatedNews();
    await createNews("LIST-CASE-AB01");
    await login(page, TEST_USERS.admin);
    await page.goto("/news");
    await page.getByLabel("文言").fill(" ab01 ");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByText("E2E-NEWS-LIST-CASE-AB01")).toBeVisible();
    await expect(page).toHaveURL(/keyword=ab01/);
    await page.screenshot({
      path: path.join(evidenceDir, "004_keyword-normalize.png"),
      fullPage: true,
    });
  });

  test("TC-005 検索結果が0件なら空表示と無効なページ送りを表示する", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news?keyword=ZZZZZZZZ");
    await expect(page.getByText("該当するお知らせがありません")).toBeVisible();
    await expect(page.getByText("検索結果 全0件（1 / 1ページ）")).toBeVisible();
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "次へ" })).toBeDisabled();
    await page.screenshot({ path: path.join(evidenceDir, "005_no-result.png"), fullPage: true });
  });

  test("TC-006 不正なURLクエリを初期値として扱う", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news?category=UNKNOWN&page=0&sort=unknown&order=unknown");
    await expect(page.getByRole("heading", { name: "お知らせ管理" })).toBeVisible();
    await expect(page.getByText(/検索結果 全.*（1 \/ 1ページ）/)).toBeVisible();
    await page.screenshot({
      path: path.join(evidenceDir, "006_invalid-query.png"),
      fullPage: true,
    });
  });

  test("TC-007 見出しクリックで昇順・降順を切り替える", async ({ page }) => {
    await deleteCreatedNews();
    await createNews("LIST-SORT-A", { startAt: new Date("2026-08-20T00:00:00Z") });
    await createNews("LIST-SORT-B", { startAt: new Date("2026-08-21T00:00:00Z") });
    await login(page, TEST_USERS.admin);
    await page.goto("/news?keyword=E2E-NEWS-LIST-SORT");
    await page.getByRole("link", { name: /タイトル/ }).click();
    await expect(page).toHaveURL(/sort=title&order=asc/);
    await page.screenshot({ path: path.join(evidenceDir, "007_sort-asc.png"), fullPage: true });
    await page.getByRole("link", { name: /タイトル/ }).click();
    await expect(page).toHaveURL(/sort=title&order=desc/);
    await page.screenshot({ path: path.join(evidenceDir, "007_sort-desc.png"), fullPage: true });
  });

  test("TC-008 ページ送りで次ページを表示する", async ({ page }) => {
    await deleteCreatedNews();
    for (let index = 0; index < NEWS_PAGE_SIZE + 1; index += 1)
      await createNews(`LIST-PAGE-${String(index).padStart(2, "0")}`, {
        startAt: new Date("2026-08-27T00:00:00Z"),
      });
    await login(page, TEST_USERS.admin);
    await page.goto("/news?keyword=E2E-NEWS-LIST-PAGE");
    await expect(page.getByRole("button", { name: "前へ" })).toBeDisabled();
    await page.screenshot({ path: path.join(evidenceDir, "008_page-1.png"), fullPage: true });
    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("E2E-NEWS-LIST-PAGE-30")).toBeVisible();
    await page.screenshot({ path: path.join(evidenceDir, "008_page-2.png"), fullPage: true });
  });

  test("TC-009 条件をクリアすると初期表示へ戻る", async ({ page }) => {
    await login(page, TEST_USERS.admin);
    await page.goto("/news?category=NEWS&keyword=E2E&page=2&sort=title&order=asc");
    await page.getByRole("button", { name: "条件をクリア" }).click();
    await expect(page).toHaveURL("http://localhost:3000/news");
    await page.screenshot({ path: path.join(evidenceDir, "009_clear.png"), fullPage: true });
  });

  test("TC-010 OPERATORは入場でき、VIEWERはトップへ戻る", async ({ browser }) => {
    const operatorContext = await browser.newContext();
    const operatorPage = await operatorContext.newPage();
    await login(operatorPage, TEST_USERS.operator);
    await operatorPage.goto("/news");
    await expect(operatorPage.getByRole("heading", { name: "お知らせ管理" })).toBeVisible();
    await operatorPage.screenshot({
      path: path.join(evidenceDir, "010_operator.png"),
      fullPage: true,
    });
    await operatorContext.close();
    const viewerContext = await browser.newContext();
    const viewerPage = await viewerContext.newPage();
    await login(viewerPage, TEST_USERS.viewer);
    await viewerPage.goto("/news");
    await expect(viewerPage).toHaveURL("http://localhost:3000/");
    await viewerPage.screenshot({ path: path.join(evidenceDir, "010_viewer.png"), fullPage: true });
    await viewerContext.close();
  });
});
