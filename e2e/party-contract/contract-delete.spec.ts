import { expect, test } from "@playwright/test";
import { evidenceDirectory, login, prisma, selectParty } from "./contract-test-helpers";

const evidence = evidenceDirectory("UT_24_契約削除");

test.describe.serial("契約削除（CTR-04）", () => {
  let partyId: string;
  let deletedId: string;
  let deletedTitle: string;
  const ids: string[] = [];
  async function make(title: string) {
    const contract = await prisma.contract.create({ data: { partyId, title } });
    ids.push(contract.id);
    return contract;
  }
  test.beforeAll(async () => {
    partyId = (await prisma.party.create({ data: { name: "E2E契約削除先" } })).id;
  });
  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { id: { in: ids } } });
    await prisma.party.delete({ where: { id: partyId } });
    await prisma.$disconnect();
  });

  test("TC-001 確認ダイアログから契約を物理削除する", async ({ page }) => {
    const contract = await make("E2E削除対象");
    deletedId = contract.id;
    deletedTitle = contract.title;
    await login(page);
    await page.goto(`/contracts/${contract.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("契約を削除しますか？")).toBeVisible();
    await expect(dialog.getByText(contract.title, { exact: true })).toBeVisible();
    await expect(dialog.getByText("E2E契約削除先", { exact: true })).toBeVisible();
    await expect(dialog.getByText("削除した契約は元に戻せません。")).toBeVisible();
    await page.screenshot({ path: evidence("001_削除確認ダイアログ.png"), fullPage: true });
    await dialog.getByRole("button", { name: "削除する" }).click();
    await expect(page).toHaveURL(/\/contracts(\?.*deleted=1)?$/, { timeout: 15000 });
    await expect(page.getByText("削除しました").first()).toBeVisible({ timeout: 15000 });
    expect(await prisma.contract.findUnique({ where: { id: contract.id } })).toBeNull();
    await page.screenshot({ path: evidence("001_削除完了後一覧.png"), fullPage: true });
  });

  test("TC-002 削除した契約を検索結果へ表示しない", async ({ page }) => {
    await login(page);
    await page.goto("/contracts");
    await selectParty(page, "E2E契約削除先");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: deletedTitle })).toHaveCount(0);
    await page.screenshot({ path: evidence("002_削除後検索結果に含まれない.png"), fullPage: true });
  });

  test("TC-003 削除した契約の詳細は404になる", async ({ page }) => {
    await login(page);
    expect((await page.goto(`/contracts/${deletedId}`))?.status()).toBe(404);
    await page.screenshot({ path: evidence("003_削除後404.png"), fullPage: true });
  });

  test("TC-004 先に削除された契約ならエラーを表示する", async ({ page }) => {
    const contract = await make("E2E削除不在");
    await login(page);
    await page.goto(`/contracts/${contract.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await prisma.contract.delete({ where: { id: contract.id } });
    ids.splice(ids.indexOf(contract.id), 1);
    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("対象の契約が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("004_存在しない契約エラー.png"), fullPage: true });
  });

  test("TC-005 更新日時が変わった契約は削除しない", async ({ page }) => {
    const contract = await make("E2E削除競合");
    await login(page);
    await page.goto(`/contracts/${contract.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await prisma.contract.update({ where: { id: contract.id }, data: { title: "先行更新" } });
    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    expect((await prisma.contract.findUniqueOrThrow({ where: { id: contract.id } })).title).toBe(
      "先行更新",
    );
    await page.screenshot({ path: evidence("005_同時更新エラー.png"), fullPage: true });
  });

  test.skip("TC-006 VIEWERのServer Action直接実行はPlaywright対象外", async () => {});

  test("TC-007 存在確認後に同時更新エラーを返す", async ({ page }) => {
    const contract = await make("E2E削除順序");
    await login(page);
    await page.goto(`/contracts/${contract.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await prisma.contract.update({ where: { id: contract.id }, data: { title: "順序先行更新" } });
    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    expect(await prisma.contract.findUnique({ where: { id: contract.id } })).not.toBeNull();
    await page.screenshot({ path: evidence("007_検証順序確認.png"), fullPage: true });
  });
});
