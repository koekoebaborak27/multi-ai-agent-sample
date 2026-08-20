import { test, expect } from "@playwright/test";
import { evidenceDirectory, login, prisma } from "./contract-test-helpers";
const evidence = evidenceDirectory("UT_22_契約詳細");
test.describe.serial("契約詳細（CTR-04）", () => {
  let partyId: string, contractId: string, nullContractId: string;
  test.beforeAll(async () => {
    const p = await prisma.party.create({ data: { name: "E2E詳細契約先" } });
    partyId = p.id;
    const c = await prisma.contract.create({
      data: {
        partyId,
        title: "E2E詳細契約",
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-12-31"),
        status: "ACTIVE",
        createdBy: "admin",
        updatedBy: "admin",
      },
    });
    contractId = c.id;
    const n = await prisma.contract.create({ data: { partyId, title: "E2E未設定契約" } });
    nullContractId = n.id;
  });
  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { partyId } });
    await prisma.party.delete({ where: { id: partyId } });
    await prisma.$disconnect();
  });
  test("TC-001〜TC-005 詳細項目・リンク・登録メッセージ", async ({ page, context }) => {
    await login(page);
    await page.goto(`/contracts/${contractId}?created=1`);
    await expect(page.getByText("E2E詳細契約", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("有効", { exact: true })).toBeVisible();
    await expect(page.getByText("登録しました")).toBeVisible();
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "E2E詳細契約先" }).click(),
    ]);
    await expect(tab).toHaveURL(`/parties/${partyId}`);
    await page.screenshot({ path: evidence("001_詳細表示項目.png"), fullPage: true });
  });
  test("TC-003〜TC-006 未設定・404", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${nullContractId}`);
    await expect(page.getByText("未定", { exact: true })).toHaveCount(2);
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    const response = await page.goto("/contracts/nonexistent-id");
    expect(response?.status()).toBe(404);
  });
  test("TC-007〜TC-008 権限別ボタン表示", async ({ page }) => {
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123");
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole("link", { name: "編集する" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
    await page.screenshot({ path: evidence("007_VIEWER編集削除ボタン非表示.png"), fullPage: true });
  });
});
