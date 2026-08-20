import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import {
  evidenceDirectory,
  login,
  prisma,
  selectOption,
  selectParty,
} from "./contract-test-helpers";

const evidence = evidenceDirectory("UT_21_契約新規登録");

async function setHiddenValue(page: Page, name: string, value: string) {
  await page.locator(`input[name="${name}"]`).evaluate((input, next) => {
    (input as HTMLInputElement).value = next;
  }, value);
}

test.describe.serial("契約新規登録（CTR-02/03）", () => {
  let party: { id: string; name: string };
  let category: { id: number; content: string };
  let wrongCategoryId: number;
  const createdContractIds: string[] = [];

  test.beforeAll(async () => {
    party = await prisma.party.create({ data: { name: "E2E契約登録先" } });
    category = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_TYPE" } },
    });
    wrongCategoryId = (
      await prisma.master.findFirstOrThrow({
        where: { category: { code: "CONTRACT_COMPANY_TYPE" } },
      })
    ).id;
  });

  test.afterAll(async () => {
    await prisma.contract.deleteMany({ where: { id: { in: createdContractIds } } });
    await prisma.contract.deleteMany({ where: { partyId: party.id } });
    await prisma.party.deleteMany({ where: { id: party.id } });
    await prisma.$disconnect();
  });

  async function openForm(page: Page, title: string, select = true) {
    await login(page);
    await page.goto("/contracts/new");
    if (select) await selectParty(page, party.name);
    await page.getByRole("textbox", { name: "契約名" }).fill(title);
  }

  test("TC-001 必須項目だけで契約を登録する", async ({ page }) => {
    await openForm(page, "新規登録確認契約");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("新規登録", { exact: true })).toBeVisible();
    await expect(page.getByText(party.name, { exact: true })).toBeVisible();
    await expect(page.getByText("新規登録確認契約", { exact: true })).toBeVisible();
    await expect(page.getByText(/未定/).first()).toBeVisible();
    await expect(page.getByText("下書き", { exact: true })).toBeVisible();
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await expect(page.getByText("現在の契約名")).toHaveCount(0);
    await page.screenshot({ path: evidence("001_新規登録確認画面.png"), fullPage: true });
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    const contract = await prisma.contract.findFirstOrThrow({
      where: { title: "新規登録確認契約" },
    });
    createdContractIds.push(contract.id);
    expect(contract).toMatchObject({
      partyId: party.id,
      status: "DRAFT",
      categoryMasterId: null,
      createdBy: "admin",
      updatedBy: "admin",
    });
    expect(contract.startDate).toBeNull();
    expect(contract.endDate).toBeNull();
    await page.screenshot({ path: evidence("001_新規登録完了後詳細画面.png"), fullPage: true });
  });

  test("TC-002 全項目を指定して契約を登録する", async ({ page }) => {
    await openForm(page, "全項目登録確認契約");
    await page.getByLabel("開始日").fill("2026-01-01");
    await page.getByLabel("終了日").fill("2026-12-31");
    await selectOption(page, "有効", "状態");
    await selectOption(page, category.content, "契約分類");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("2026-01-01 〜 2026-12-31")).toBeVisible();
    await expect(page.getByText(category.content, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    const contract = await prisma.contract.findFirstOrThrow({
      where: { title: "全項目登録確認契約" },
    });
    createdContractIds.push(contract.id);
    expect(contract.status).toBe("ACTIVE");
    expect(contract.categoryMasterId).toBe(category.id);
    await page.screenshot({ path: evidence("002_全項目登録完了.png"), fullPage: true });
  });

  test("TC-003 契約先未選択なら必須エラーを表示する", async ({ page }) => {
    await openForm(page, "契約先未選択", false);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("契約先は必須です")).toBeVisible();
    await page.screenshot({ path: evidence("003_契約先未選択エラー.png"), fullPage: true });
  });

  test("TC-004 契約名未入力なら必須エラーを表示する", async ({ page }) => {
    await openForm(page, "");
    await page
      .getByRole("textbox", { name: "契約名" })
      .evaluate((input) => input.removeAttribute("required"));
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("契約名は必須です")).toBeVisible();
    await page.screenshot({ path: evidence("004_契約名未入力エラー.png"), fullPage: true });
  });

  test("TC-005 存在しない契約先IDならエラーを表示する", async ({ page }) => {
    await openForm(page, "不正契約先確認");
    await setHiddenValue(page, "partyId", "nonexistent-party-id");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("対象の契約先が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("005_存在しない契約先IDエラー.png"), fullPage: true });
  });

  test("TC-006 契約分類以外のマスタIDならエラーを表示する", async ({ page }) => {
    await openForm(page, "不正分類確認");
    await setHiddenValue(page, "categoryMasterId", String(wrongCategoryId));
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(
      page.getByText("選択した内容が見つかりません。画面を更新してから選び直してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("006_分類コード不一致エラー.png"), fullPage: true });
  });

  test("TC-007 契約名200文字なら登録できる", async ({ page }) => {
    const title = "あ".repeat(200);
    await openForm(page, title);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    const contract = await prisma.contract.findFirstOrThrow({ where: { title } });
    createdContractIds.push(contract.id);
    await page.screenshot({ path: evidence("007_契約名200文字登録成功.png"), fullPage: true });
  });

  test("TC-008 契約名201文字なら登録を拒否する", async ({ page }) => {
    await openForm(page, "短縮入力");
    const title = page.getByRole("textbox", { name: "契約名" });
    await title.evaluate((input) => input.removeAttribute("maxlength"));
    await title.fill("あ".repeat(201));
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByText("契約名は200文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("008_契約名201文字登録拒否.png"), fullPage: true });
  });

  test("TC-009 入力内容を修正すると全入力値を保持する", async ({ page }) => {
    await openForm(page, "入力保持確認契約");
    await page.getByLabel("開始日").fill("2026-02-01");
    await page.getByLabel("終了日").fill("2026-11-30");
    await selectOption(page, "有効", "状態");
    await selectOption(page, category.content, "契約分類");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByRole("textbox", { name: "契約名" })).toHaveValue("入力保持確認契約");
    await expect(page.getByLabel("開始日")).toHaveValue("2026-02-01");
    await expect(page.getByLabel("終了日")).toHaveValue("2026-11-30");
    await page.screenshot({ path: evidence("009_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-010 キャンセルすると入力を破棄する", async ({ page }) => {
    const title = "キャンセル破棄確認契約";
    await openForm(page, title);
    await page.getByRole("link", { name: "キャンセル" }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    expect(await prisma.contract.findFirst({ where: { title } })).toBeNull();
    await page.screenshot({ path: evidence("010_キャンセルで破棄.png"), fullPage: true });
  });

  test("TC-011 契約先0件なら案内を表示して確認を無効にする", async ({ page }) => {
    const contracts = await prisma.contract.findMany();
    const parties = await prisma.party.findMany();
    fs.writeFileSync(evidence("db_before.json"), JSON.stringify({ contracts, parties }, null, 2));
    await prisma.contract.deleteMany();
    await prisma.party.deleteMany();
    try {
      await login(page);
      await page.goto("/contracts/new");
      await expect(
        page.getByText("契約先が登録されていません。先に契約先を登録してください。"),
      ).toBeVisible();
      await expect(page.getByRole("link", { name: "契約先を登録する" })).toBeVisible();
      await expect(page.getByRole("button", { name: "確認する" })).toBeDisabled();
      await page.screenshot({ path: evidence("011_契約先0件時案内表示.png"), fullPage: true });
    } finally {
      await prisma.party.createMany({ data: parties });
      await prisma.contract.createMany({ data: contracts });
      fs.writeFileSync(
        evidence("db_after.json"),
        JSON.stringify(
          {
            restoredParties: parties.length,
            restoredContracts: contracts.length,
          },
          null,
          2,
        ),
      );
    }
  });

  test("TC-012 VIEWERは新規登録画面へアクセスできない", async ({ page }) => {
    await login(page, "viwTest", process.env.SEED_VIEWER_PASSWORD ?? "test@123");
    await page.goto("/contracts/new");
    await expect(page).toHaveURL("http://localhost:3000/contracts");
    await page.screenshot({ path: evidence("012_VIEWER権限制御.png"), fullPage: true });
  });
});
