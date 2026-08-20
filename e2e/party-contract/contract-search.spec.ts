import { test, expect } from "@playwright/test";
import {
  evidenceDirectory,
  login,
  prisma,
  selectOption,
  selectParty,
} from "./contract-test-helpers";

const evidence = evidenceDirectory("UT_20_契約検索一覧");

test.describe.serial("契約検索一覧（CTR-01）", () => {
  const partyIds: string[] = [];
  const contractIds: string[] = [];
  let categoryId: number;
  let partyName: string;
  let emptyPartyId: string;

  test.beforeAll(async () => {
    const category = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_TYPE" } },
    });
    categoryId = category.id;
    const emptyParty = await prisma.party.create({ data: { name: "E2E契約なし検索先" } });
    emptyPartyId = emptyParty.id;
    partyIds.push(emptyParty.id);
    for (let index = 0; index < 31; index += 1) {
      const party = await prisma.party.create({ data: { name: `E2E契約検索先${index}` } });
      partyIds.push(party.id);
      if (index === 0) partyName = party.name;
      const contract = await prisma.contract.create({
        data: {
          partyId: party.id,
          title: `E2E契約検索${String(index).padStart(2, "0")}`,
          status: index % 2 ? "ACTIVE" : "DRAFT",
          categoryMasterId: index % 3 ? categoryId : null,
        },
      });
      contractIds.push(contract.id);
    }
  });

  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
    await prisma.party.deleteMany({ where: { id: { in: partyIds } } });
    await prisma.$disconnect();
  });

  test("TC-001 契約先で絞り込むと対象契約だけを表示する", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    await selectParty(page, partyName);
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: "E2E契約検索00" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "E2E契約検索01" })).toHaveCount(0);
    await page.screenshot({ path: evidence("001_契約先絞り込み結果.png"), fullPage: true });
  });

  test("TC-002 契約先コンボボックスは通信せず名称を絞り込む", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));
    await page.getByRole("combobox", { name: "契約先" }).click();
    await page.getByPlaceholder("契約先名で検索").fill("検索先0");
    await expect(page.getByRole("option", { name: partyName })).toBeVisible();
    expect(requests.filter((url) => url.includes("/api/")).length).toBe(0);
    await page.screenshot({ path: evidence("002_コンボボックス名称絞り込み.png"), fullPage: true });
  });

  test("TC-003 状態で絞り込むと有効な契約だけを表示する", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    await selectOption(page, "有効", "状態");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: "E2E契約検索01" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "E2E契約検索00" })).toHaveCount(0);
    await expect(page.getByRole("cell", { name: "下書き", exact: true })).toHaveCount(0);
    await page.screenshot({ path: evidence("003_状態絞り込み結果.png"), fullPage: true });
  });

  test("TC-004 契約分類で絞り込むと対象分類だけを表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts?categoryId=${categoryId}`);
    await expect(page.getByRole("cell", { name: "E2E契約検索01" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "E2E契約検索00" })).toHaveCount(0);
    await page.screenshot({ path: evidence("004_契約分類絞り込み結果.png"), fullPage: true });
  });

  test("TC-005 複数条件をAND条件で検索する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts?partyId=${partyIds[2]}&status=ACTIVE&categoryId=${categoryId}`);
    await expect(page.getByRole("cell", { name: "E2E契約検索01" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.screenshot({ path: evidence("005_AND条件検索結果.png"), fullPage: true });
  });

  test("TC-006 条件未指定で全契約を検索対象にする", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    const summary = await page.getByText(/検索結果 全\d+件/).innerText();
    expect(Number(summary.match(/\d+/)?.[0])).toBeGreaterThanOrEqual(31);
    await page.screenshot({ path: evidence("006_全件表示.png"), fullPage: true });
  });

  test("TC-007 1ページ30件で2ページ目へ移動できる", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    const firstPage = await page.locator("tbody tr").allTextContents();
    expect(firstPage).toHaveLength(30);
    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);
    const secondPage = await page.locator("tbody tr").allTextContents();
    expect(secondPage).not.toEqual(firstPage);
    await page.screenshot({ path: evidence("007_ページング確認.png"), fullPage: true });
  });

  test("TC-008 5列を昇順・降順で並び替えられる", async ({ page }) => {
    await login(page);
    const columns = ["契約名", "契約先", "開始日", "終了日", "状態"];
    await page.goto("/contracts");
    for (const column of columns) {
      const desc = page.getByRole("link", { name: `${column}を降順で並べ替える` });
      if (await desc.count()) await desc.click();
      else await page.getByRole("link", { name: `${column}を昇順で並べ替える` }).click();
      await expect(page).toHaveURL(/order=(asc|desc)/);
    }
    await page.screenshot({ path: evidence("008_各列並び替え.png"), fullPage: true });
  });

  test("TC-009 検索条件を変更すると1ページ目へ戻る", async ({ page }) => {
    await login(page);
    await page.goto("/contracts?page=2");
    await selectOption(page, "有効", "状態");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page).not.toHaveURL(/page=2/);
    await page.screenshot({ path: evidence("009_検索でページ1へ.png"), fullPage: true });
  });

  test("TC-010 条件をクリアすると初期状態へ戻る", async ({ page }) => {
    await login(page);
    await page.goto(
      `/contracts?partyId=${partyIds[1]}&status=ACTIVE&categoryId=${categoryId}&page=2`,
    );
    await page.getByRole("button", { name: "条件をクリア" }).click();
    await expect(page).toHaveURL("http://localhost:3000/contracts");
    await expect(page.getByRole("combobox", { name: "契約先" })).toContainText("すべて");
    await expect(page.getByRole("combobox", { name: "状態" })).toContainText("すべて");
    await expect(page.getByRole("combobox", { name: "契約分類" })).toContainText("すべて");
    await page.screenshot({ path: evidence("010_条件クリア.png"), fullPage: true });
  });

  test("TC-011 VIEWERには新規登録ボタンを表示しない", async ({ page }) => {
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123");
    await page.goto("/contracts");
    await expect(page.getByRole("link", { name: "新規登録" })).toHaveCount(0);
    await expect(page.getByText(/検索結果 全\d+件/)).toBeVisible();
    await page.screenshot({ path: evidence("011_VIEWER新規登録ボタン非表示.png"), fullPage: true });
  });

  test("TC-012 検索結果が0件なら案内を表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts?partyId=${emptyPartyId}`);
    await expect(page.getByText("該当する契約がありません")).toBeVisible();
    await page.screenshot({ path: evidence("012_検索結果0件.png"), fullPage: true });
  });
});
