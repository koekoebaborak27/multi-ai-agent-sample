import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  createEvidenceDir,
  createNews,
  deleteCreatedNews,
  login,
  loadMoreUntilVisible,
  NEWS_PAGE_SIZE,
  prisma,
  TEST_USERS,
  writeEvidenceJson,
} from "./news-test-helpers";

/** トップ画面お知らせ表示（NEWS-01）の画面操作テスト。 */
test.describe.serial("トップ画面お知らせ表示（NEWS-01）", () => {
  const evidenceDir = createEvidenceDir("テスト結果UT_10_トップ画面お知らせ表示");
  let originalNews: Awaited<ReturnType<typeof prisma.news.findMany>> = [];

  test.beforeAll(async () => {
    // 0件確認で既存データを一時的に非公開化するため、復元に必要な全列を保存する。
    originalNews = await prisma.news.findMany();
    writeEvidenceJson(evidenceDir, "db_before_News.json", originalNews);
    await deleteCreatedNews();
  });

  test.afterAll(async () => {
    // テスト専用行を削除し、0件確認で変更した既存行も元の値に戻す。
    await deleteCreatedNews();
    for (const item of originalNews) {
      await prisma.news.update({
        where: { id: item.id },
        data: {
          title: item.title,
          body: item.body,
          category: item.category,
          published: item.published,
          startAt: item.startAt,
          endAt: item.endAt,
          createdAt: item.createdAt,
          createdBy: item.createdBy,
          updatedBy: item.updatedBy,
        },
      });
    }
    writeEvidenceJson(evidenceDir, "db_after_News.json", await prisma.news.findMany());
    await prisma.$disconnect();
  });

  test("TC-001 公開中のお知らせをカテゴリと日時の優先順で表示する", async ({ page }) => {
    await createNews("TOP-INCIDENT-OLD", {
      category: "INCIDENT",
      startAt: new Date("2026-08-20T00:00:00Z"),
    });
    await createNews("TOP-INCIDENT-NEW", {
      category: "INCIDENT",
      startAt: new Date("2026-08-21T00:00:00Z"),
    });
    await createNews("TOP-MAINTENANCE", { category: "MAINTENANCE" });
    await createNews("TOP-NEWS", { category: "NEWS" });
    await login(page, TEST_USERS.admin);
    await expect(page.getByText("お知らせ", { exact: true })).toBeVisible();
    await loadMoreUntilVisible(page, "E2E-NEWS-TOP-NEWS");
    const text = await page.locator("main").innerText();
    expect(text.indexOf("E2E-NEWS-TOP-INCIDENT-NEW")).toBeLessThan(
      text.indexOf("E2E-NEWS-TOP-MAINTENANCE"),
    );
    expect(text.indexOf("E2E-NEWS-TOP-MAINTENANCE")).toBeLessThan(
      text.indexOf("E2E-NEWS-TOP-NEWS"),
    );
    await page.screenshot({
      path: path.join(evidenceDir, "001_published-order.png"),
      fullPage: true,
    });
  });

  test("TC-002 公開判定と本文の改行・HTML文字列表示を確認する", async ({ page }) => {
    await deleteCreatedNews();
    await createNews("TOP-VISIBLE-EMPTY-START", {
      body: "1行目\n<script>test</script>",
      startAt: null,
    });
    await createNews("TOP-SCHEDULED", { startAt: new Date("2099-01-01T00:00:00Z") });
    await createNews("TOP-ENDED", { endAt: new Date("2000-01-01T00:00:00Z") });
    await createNews("TOP-HIDDEN", { published: false });
    await login(page, TEST_USERS.admin);
    await loadMoreUntilVisible(page, "E2E-NEWS-TOP-VISIBLE-EMPTY-START");
    await expect(page.getByText("E2E-NEWS-TOP-VISIBLE-EMPTY-START")).toBeVisible();
    await expect(page.getByText("<script>test</script>")).toBeVisible();
    await expect(page.getByText("E2E-NEWS-TOP-SCHEDULED")).toHaveCount(0);
    await expect(page.getByText("E2E-NEWS-TOP-ENDED")).toHaveCount(0);
    await expect(page.getByText("E2E-NEWS-TOP-HIDDEN")).toHaveCount(0);
    await page.screenshot({
      path: path.join(evidenceDir, "002_publish-condition.png"),
      fullPage: true,
    });
  });

  test("TC-003 公開中のお知らせが0件なら空状態を表示する", async ({ page }) => {
    await deleteCreatedNews();
    await prisma.news.updateMany({ data: { published: false } });
    await login(page, TEST_USERS.admin);
    await expect(page.getByText("現在お知らせはありません")).toBeVisible();
    await expect(page.getByRole("button", { name: "さらに表示" })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDir, "003_empty.png"), fullPage: true });
    // 後続ケースが公開中データを使えるよう、この場で戻す。
    for (const item of originalNews)
      await prisma.news.update({ where: { id: item.id }, data: { published: item.published } });
  });

  test("TC-004 さらに表示で次ページを画面遷移なしに追加する", async ({ page }) => {
    await deleteCreatedNews();
    // 実行時刻からの相対オフセットにして、必ず公開中（過去日時）になるようにする。
    const base = Date.now();
    for (let index = 0; index < NEWS_PAGE_SIZE + 1; index += 1) {
      await createNews(`TOP-MORE-${String(index).padStart(2, "0")}`, {
        startAt: new Date(base - index * 60_000),
      });
    }
    await login(page, TEST_USERS.admin);
    await expect(page.getByRole("button", { name: "さらに表示" })).toBeVisible();
    const displayedBefore = await page.getByRole("listitem").count();
    await page.screenshot({
      path: path.join(evidenceDir, "004_before-load-more.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "さらに表示" }).click();
    // クリック直後は追加取得が反映されていないため、件数が増えるまで待ってから確認する。
    await expect(page.getByRole("listitem")).not.toHaveCount(displayedBefore);
    await page.screenshot({
      path: path.join(evidenceDir, "004_after-load-more.png"),
      fullPage: true,
    });
  });

  test("TC-005 表示件数がページサイズ未満ならさらに表示を出さない", async ({ page }) => {
    await deleteCreatedNews();
    await prisma.news.updateMany({ data: { published: false } });
    await createNews("TOP-SINGLE");
    await login(page, TEST_USERS.admin);
    await expect(page.getByText("E2E-NEWS-TOP-SINGLE")).toBeVisible();
    await expect(page.getByRole("button", { name: "さらに表示" })).toHaveCount(0);
    await page.screenshot({ path: path.join(evidenceDir, "005_no-load-more.png"), fullPage: true });
    for (const item of originalNews)
      await prisma.news.update({ where: { id: item.id }, data: { published: item.published } });
  });

  test("TC-006 ADMIN・OPERATOR・VIEWERの全ロールで閲覧できる", async ({ browser }) => {
    await deleteCreatedNews();
    await createNews("TOP-ALL-ROLES");
    for (const [role, user] of Object.entries(TEST_USERS)) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user);
      await loadMoreUntilVisible(page, "E2E-NEWS-TOP-ALL-ROLES");
      await expect(page.getByText("E2E-NEWS-TOP-ALL-ROLES")).toBeVisible();
      await page.screenshot({
        path: path.join(evidenceDir, `006_role-${role}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });
});
