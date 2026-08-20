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
  test("TC-001 契約の全詳細項目を表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByText("E2E詳細契約", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "E2E詳細契約先" })).toBeVisible();
    await expect(page.getByText("2026-01-01", { exact: true })).toBeVisible();
    await expect(page.getByText("2026-12-31", { exact: true })).toBeVisible();
    await expect(page.getByText("有効", { exact: true })).toBeVisible();
    await expect(page.getByText("admin", { exact: true })).toHaveCount(2);
    await page.screenshot({ path: evidence("001_詳細表示項目.png"), fullPage: true });
  });

  test("TC-002 契約先名から新しいタブで契約先詳細を開く", async ({ page, context }) => {
    await login(page);
    await page.goto(`/contracts/${contractId}`);
    const [tab] = await Promise.all([
      context.waitForEvent("page"),
      page.getByRole("link", { name: "E2E詳細契約先" }).click(),
    ]);
    await expect(tab).toHaveURL(`/parties/${partyId}`);
    await tab.screenshot({ path: evidence("002_契約先リンク遷移.png"), fullPage: true });
    await tab.close();
  });

  test("TC-003 登録者と更新者が不明ならダッシュを表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${nullContractId}`);
    await expect(page.getByText("—", { exact: true })).toHaveCount(2);
    await page.screenshot({ path: evidence("003_登録者不明時表示.png"), fullPage: true });
  });

  test("TC-004 未設定の日付と分類には案内文言を表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${nullContractId}`);
    await expect(page.getByText("未定", { exact: true })).toHaveCount(2);
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("004_未設定項目表示.png"), fullPage: true });
  });

  test("TC-005 登録直後に完了メッセージを表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${contractId}?created=1`);
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("005_登録完了メッセージ.png"), fullPage: true });
  });

  test("TC-006 存在しない契約IDなら404を返す", async ({ page }) => {
    await login(page);
    const response = await page.goto("/contracts/nonexistent-id");
    expect(response?.status()).toBe(404);
    await page.screenshot({ path: evidence("006_存在しないID404.png"), fullPage: true });
  });

  test("TC-007 VIEWERには編集と削除を表示しない", async ({ page }) => {
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123");
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole("link", { name: "編集する" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();
    await page.screenshot({ path: evidence("007_VIEWER編集削除ボタン非表示.png"), fullPage: true });
  });

  test("TC-008 ADMINには編集と削除を表示する", async ({ page }) => {
    await login(page);
    await page.goto(`/contracts/${contractId}`);
    await expect(page.getByRole("link", { name: "編集する" })).toBeVisible();
    await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
    await page.screenshot({ path: evidence("008_ADMIN編集削除ボタン表示.png"), fullPage: true });
  });
});
