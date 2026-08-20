import { expect, test, type Page } from "@playwright/test";
import { evidenceDirectory, login, prisma, selectOption } from "./contract-test-helpers";

const evidence = evidenceDirectory("UT_23_契約更新");

// 更新確認時に送信されるフォームの指定項目を1回だけ差し替える。
// React 19が内部状態から組み立てる送信内容を使い、不正なIDを受け取った場合のサーバー側検証を確認する。
async function interceptFieldOnce(page: Page, field: string, value: string) {
  let intercepted = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    const buffer = request.postDataBuffer();
    if (intercepted || request.method() !== "POST" || !buffer) return route.continue();
    const text = buffer.toString("utf-8");
    const pattern = new RegExp(`(name="_\\d+_${field}"\\r\\n\\r\\n)[^\\r\\n]*(\\r\\n)`);
    if (!pattern.test(text)) return route.continue();
    intercepted = true;
    await route.continue({ postData: Buffer.from(text.replace(pattern, `$1${value}$2`), "utf-8") });
  });
}

test.describe.serial("契約更新（CTR-05/03）", () => {
  let partyId: string;
  let otherPartyId: string;
  let categoryId: number;
  let otherCategoryId: number;
  const ids: string[] = [];
  async function create(title: string) {
    const contract = await prisma.contract.create({
      data: {
        partyId,
        title,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        status: "ACTIVE",
        categoryMasterId: categoryId,
        createdBy: "admin",
        updatedBy: "admin",
      },
    });
    ids.push(contract.id);
    return contract;
  }
  async function open(page: Page, id: string) {
    await login(page);
    await page.goto(`/contracts/${id}/edit`);
  }
  async function execute(page: Page) {
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
  }
  test.beforeAll(async () => {
    partyId = (await prisma.party.create({ data: { name: "E2E契約更新先" } })).id;
    otherPartyId = (await prisma.party.create({ data: { name: "E2E別契約先" } })).id;
    const categories = await prisma.master.findMany({
      where: { category: { code: "CONTRACT_TYPE" } },
      take: 2,
      orderBy: { id: "asc" },
    });
    categoryId = categories[0].id;
    otherCategoryId = categories[1].id;
  });
  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { id: { in: ids } } });
    await prisma.party.deleteMany({ where: { id: { in: [partyId, otherPartyId] } } });
    await prisma.$disconnect();
  });

  test("TC-001 契約先を読み取り専用で表示する", async ({ page }) => {
    const c = await create("E2E更新読取");
    await open(page, c.id);
    await expect(page.getByText("E2E契約更新先", { exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "契約先" })).toHaveCount(0);
    await page.screenshot({ path: evidence("001_契約先読み取り専用表示.png"), fullPage: true });
  });

  test("TC-002 契約名だけを更新する", async ({ page }) => {
    const c = await create("更新前契約名");
    await open(page, c.id);
    await page.getByRole("textbox", { name: "契約名" }).fill("更新確認契約");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("更新前契約名", { exact: true })).toBeVisible();
    await expect(page.getByText("更新確認契約", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_契約名単独更新確認画面.png"), fullPage: true });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    const after = await prisma.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.title).toBe("更新確認契約");
    expect(after.createdBy).toBe(c.createdBy);
    expect(after.updatedAt.getTime()).toBeGreaterThan(c.updatedAt.getTime());
    await page.screenshot({ path: evidence("002_契約名単独更新完了.png"), fullPage: true });
  });

  test("TC-003 期間だけを更新する", async ({ page }) => {
    const c = await create("期間更新契約");
    await open(page, c.id);
    await page.getByLabel("開始日").fill("2027-01-01");
    await page.getByLabel("終了日").fill("2027-12-31");
    await execute(page);
    const after = await prisma.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.startDate?.toISOString().slice(0, 10)).toBe("2027-01-01");
    expect(after.endDate?.toISOString().slice(0, 10)).toBe("2027-12-31");
    expect(after.title).toBe(c.title);
    await page.screenshot({ path: evidence("003_期間単独更新完了.png"), fullPage: true });
  });

  test("TC-004 状態だけを更新する", async ({ page }) => {
    const c = await create("状態更新契約");
    await open(page, c.id);
    await selectOption(page, "終了", "状態");
    await execute(page);
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).status).toBe(
      "TERMINATED",
    );
    await page.screenshot({ path: evidence("004_状態単独更新完了.png"), fullPage: true });
  });

  test("TC-005 契約分類だけを更新する", async ({ page }) => {
    const c = await create("分類更新契約");
    const label = (await prisma.master.findUniqueOrThrow({ where: { id: otherCategoryId } }))
      .content;
    await open(page, c.id);
    await selectOption(page, label, "契約分類");
    await execute(page);
    expect(
      (await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).categoryMasterId,
    ).toBe(otherCategoryId);
    await page.screenshot({ path: evidence("005_契約分類単独更新完了.png"), fullPage: true });
  });

  test("TC-006 契約先以外の5項目を同時更新する", async ({ page }) => {
    const c = await create("同時更新前契約");
    const label = (await prisma.master.findUniqueOrThrow({ where: { id: otherCategoryId } }))
      .content;
    await open(page, c.id);
    await page.getByRole("textbox", { name: "契約名" }).fill("同時更新後契約");
    await page.getByLabel("開始日").fill("2028-01-01");
    await page.getByLabel("終了日").fill("2028-12-31");
    await selectOption(page, "終了", "状態");
    await selectOption(page, label, "契約分類");
    await execute(page);
    const after = await prisma.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(after).toMatchObject({
      title: "同時更新後契約",
      status: "TERMINATED",
      categoryMasterId: otherCategoryId,
      partyId,
    });
    await page.screenshot({ path: evidence("006_4項目同時更新完了.png"), fullPage: true });
  });

  test("TC-007 契約分類を未設定へ変更する", async ({ page }) => {
    const c = await create("分類解除契約");
    await open(page, c.id);
    await selectOption(page, "未設定", "契約分類");
    await execute(page);
    expect(
      (await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).categoryMasterId,
    ).toBeNull();
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("007_契約分類未設定へ変更.png"), fullPage: true });
  });

  test("TC-008 追加送信された契約先IDを無視する", async ({ page }) => {
    const c = await create("契約先改ざん確認");
    await open(page, c.id);
    await interceptFieldOnce(page, "partyId", otherPartyId);
    await execute(page);
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).partyId).toBe(
      partyId,
    );
    await page.screenshot({ path: evidence("008_契約先変更無視確認.png"), fullPage: true });
  });

  test("TC-009 先に削除された契約ならエラーを表示する", async ({ page }) => {
    const c = await create("更新前削除契約");
    await open(page, c.id);
    await page.getByRole("button", { name: "確認する" }).click();
    await prisma.contract.delete({ where: { id: c.id } });
    ids.splice(ids.indexOf(c.id), 1);
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("対象の契約が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("009_存在しない契約エラー.png"), fullPage: true });
  });

  test("TC-010 存在しない分類IDならエラーを表示する", async ({ page }) => {
    const c = await create("不正分類更新契約");
    await open(page, c.id);
    await interceptFieldOnce(page, "categoryMasterId", "999999");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(
      page.getByText("選択した内容が見つかりません。画面を更新してから選び直してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("010_存在しない分類IDエラー.png"), fullPage: true });
  });

  test("TC-011 同時更新なら競合エラーを表示する", async ({ page }) => {
    const c = await create("競合更新契約");
    await open(page, c.id);
    await page.getByRole("button", { name: "確認する" }).click();
    await prisma.contract.update({ where: { id: c.id }, data: { title: "先行更新済み契約" } });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).title).toBe(
      "先行更新済み契約",
    );
    await page.screenshot({ path: evidence("011_同時更新エラー.png"), fullPage: true });
  });

  test("TC-012 値を変えずに実行して更新日時を更新する", async ({ page }) => {
    const c = await create("変更なし更新契約");
    await open(page, c.id);
    await execute(page);
    const after = await prisma.contract.findUniqueOrThrow({ where: { id: c.id } });
    expect(after.title).toBe(c.title);
    expect(after.createdBy).toBe(c.createdBy);
    expect(after.updatedAt.getTime()).toBeGreaterThan(c.updatedAt.getTime());
    await page.screenshot({ path: evidence("012_値変更なし実行成功.png"), fullPage: true });
  });

  test("TC-013 VIEWERは更新画面へアクセスできない", async ({ page }) => {
    const c = await create("VIEWER更新契約");
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123");
    await page.goto(`/contracts/${c.id}/edit`);
    await expect(page).toHaveURL(new RegExp(`/contracts/${c.id}(\\?|$)`));
    await page.screenshot({ path: evidence("013_VIEWER権限制御.png"), fullPage: true });
  });

  test("TC-014 入力内容を修正すると変更値を保持する", async ({ page }) => {
    const c = await create("修正前保持契約");
    await open(page, c.id);
    await page.getByRole("textbox", { name: "契約名" }).fill("修正後保持契約");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByRole("textbox", { name: "契約名" })).toHaveValue("修正後保持契約");
    await page.screenshot({ path: evidence("014_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-015 キャンセルすると変更を破棄する", async ({ page }) => {
    const c = await create("キャンセル前契約");
    await open(page, c.id);
    await page.getByRole("textbox", { name: "契約名" }).fill("キャンセル後契約");
    await page.getByRole("link", { name: "キャンセル" }).click();
    await expect(page).toHaveURL(new RegExp(`/contracts/${c.id}`));
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: c.id } })).title).toBe(
      "キャンセル前契約",
    );
    await page.screenshot({ path: evidence("015_キャンセルで破棄.png"), fullPage: true });
  });
});
