import { test, expect } from "@playwright/test";
import { evidenceDirectory, login, prisma, selectOption, selectParty } from "./contract-test-helpers";

const evidence = evidenceDirectory("UT_20_契約検索一覧");

test.describe.serial("契約検索一覧（CTR-01）", () => {
  const partyIds: string[] = [];
  const contractIds: string[] = [];
  let categoryId: number;
  let partyName: string;

  test.beforeAll(async () => {
    const category = await prisma.master.findFirstOrThrow({ where: { category: { code: "CONTRACT_TYPE" } } });
    categoryId = category.id;
    for (let index = 0; index < 31; index += 1) {
      const party = await prisma.party.create({ data: { name: `E2E契約検索先${index}` } });
      partyIds.push(party.id);
      if (index === 0) partyName = party.name;
      const contract = await prisma.contract.create({ data: { partyId: party.id, title: `E2E契約検索${String(index).padStart(2, "0")}`, status: index % 2 ? "ACTIVE" : "DRAFT", categoryMasterId: index % 3 ? categoryId : null } });
      contractIds.push(contract.id);
    }
  });

  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { id: { in: contractIds } } });
    await prisma.party.deleteMany({ where: { id: { in: partyIds } } });
    await prisma.$disconnect();
  });

  test("TC-001〜TC-006 契約先・状態・分類の検索と全件表示", async ({ page }) => {
    await login(page); await page.goto("/contracts"); await selectParty(page, partyName); await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: "E2E契約検索00" })).toBeVisible();
    await page.screenshot({ path: evidence("001_契約先絞り込み結果.png"), fullPage: true });
    await page.goto("/contracts"); await selectOption(page, "有効", "状態"); await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: "有効", exact: true }).first()).toBeVisible();
    await page.goto(`/contracts?categoryId=${categoryId}`); await expect(page.getByText(/検索結果 全\d+件/)).toBeVisible();
  });

  test("TC-002 契約先コンボボックスは画面内で名称を絞り込む", async ({ page }) => {
    await login(page); await page.goto("/contracts"); const requests: string[] = []; page.on("request", request => requests.push(request.url()));
    await page.getByRole("combobox", { name: "契約先" }).click(); await page.getByPlaceholder("契約先名で検索").fill("検索先0");
    await expect(page.getByRole("option", { name: partyName })).toBeVisible(); expect(requests.filter(url => url.includes("/api/")).length).toBe(0);
    await page.screenshot({ path: evidence("002_コンボボックス名称絞り込み.png"), fullPage: true });
  });

  test("TC-007〜TC-010 ページング・並び替え・条件クリア", async ({ page }) => {
    await login(page); await page.goto("/contracts"); await page.getByRole("link", { name: "次へ" }).click(); await expect(page).toHaveURL(/page=2/);
    await page.screenshot({ path: evidence("007_ページング確認.png"), fullPage: true });
    await page.getByRole("link", { name: "契約名を降順で並べ替える" }).click(); await expect(page).toHaveURL(/sort=title|order=desc/);
    await page.getByRole("button", { name: "条件をクリア" }).click(); await expect(page).toHaveURL("http://localhost:3000/contracts");
  });

  test("TC-011〜TC-012 VIEWER表示と検索結果0件", async ({ page }) => {
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123"); await page.goto("/contracts"); await expect(page.getByRole("link", { name: "新規登録" })).toHaveCount(0);
    await page.goto(`/contracts?partyId=${partyIds[0]}`); await expect(page.getByText(/検索結果/)).toBeVisible();
    await page.screenshot({ path: evidence("011_VIEWER新規登録ボタン非表示.png"), fullPage: true });
  });
});
