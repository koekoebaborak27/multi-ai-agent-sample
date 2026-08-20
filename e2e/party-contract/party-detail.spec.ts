import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(process.cwd(), "docs/test/unit/result/party-contract/テスト結果UT_12_契約先詳細");

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  role: "ADMIN",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
};
const OPERATOR = {
  id: "opeTest",
  role: "OPERATOR",
  password: process.env.SEED_OPERATOR_PASSWORD ?? "test@123",
};
const VIEWER = {
  id: "viwTest",
  role: "VIEWER",
  password: process.env.SEED_VIEWER_PASSWORD ?? "test@123",
};

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

test.describe.serial("契約先詳細（PTY-04）", () => {
  const createdPartyIds: string[] = [];
  let fullyFilledPartyId: string;
  let unsetCompanyTypePartyId: string;
  // TC-003は既存の「検証用の契約先A」（createdBy=null）を参照のみで使う

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const companyTypeMaster = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_COMPANY_TYPE" }, content: "法人" },
    });

    // TC-001・TC-006・TC-007用: 分類・連絡先・登録者・更新者が揃った契約先
    const fullyFilledParty = await prisma.party.create({
      data: {
        name: "詳細表示確認商事",
        companyTypeMasterId: companyTypeMaster.id,
        contactInfo: "03-9999-8888",
        createdBy: "admin",
        updatedBy: "admin",
      },
    });
    fullyFilledPartyId = fullyFilledParty.id;
    createdPartyIds.push(fullyFilledParty.id);

    // TC-002用: 分類未設定の契約先
    const unsetParty = await prisma.party.create({
      data: { name: "分類未設定詳細確認商事", companyTypeMasterId: null },
    });
    unsetCompanyTypePartyId = unsetParty.id;
    createdPartyIds.push(unsetParty.id);
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ createdPartyCount: createdPartyIds.length }, null, 2),
    );
    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    await prisma.$disconnect();
  });

  test("TC-001 詳細表示項目の確認", async ({ page }) => {
    const party = await prisma.party.findUniqueOrThrow({ where: { id: fullyFilledPartyId } });

    await login(page, ADMIN);
    await page.goto(`/parties/${fullyFilledPartyId}`);

    await expect(page.getByText(party.name, { exact: true }).first()).toBeVisible();
    await expect(page.getByText("法人", { exact: true })).toBeVisible();
    await expect(page.getByText("03-9999-8888", { exact: true })).toBeVisible();
    await expect(page.getByText("admin", { exact: true }).first()).toBeVisible();
    // 紐づく契約の一覧・件数は表示されない
    await expect(page.getByText("契約一覧")).toHaveCount(0);
    await page.screenshot({ path: evidence("001_詳細表示項目.png"), fullPage: true });
  });

  test("TC-002 分類未設定時の「未設定」表示", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/parties/${unsetCompanyTypePartyId}`);

    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_分類未設定表示.png"), fullPage: true });
  });

  test("TC-003 登録者・更新者不明時の「—」表示", async ({ page }) => {
    const existing = await prisma.party.findFirstOrThrow({
      where: { createdBy: null, updatedBy: null },
    });

    await login(page, ADMIN);
    await page.goto(`/parties/${existing.id}`);

    await expect(page.getByText("—").first()).toBeVisible();
    const unknownCount = await page.getByText("—", { exact: true }).count();
    expect(unknownCount).toBeGreaterThanOrEqual(2);
    await page.screenshot({ path: evidence("003_登録者不明時表示.png"), fullPage: true });
  });

  test("TC-004 登録直後の完了メッセージ", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("登録直後メッセージ確認商事");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page).toHaveURL(/\/parties\/[^/]+\?created=1/, { timeout: 15000 });
    await expect(page.getByText("登録しました")).toBeVisible();
    await page.screenshot({ path: evidence("004_登録完了メッセージ.png"), fullPage: true });

    const created = await prisma.party.findFirstOrThrow({
      where: { name: "登録直後メッセージ確認商事" },
    });
    createdPartyIds.push(created.id);
  });

  test("TC-005 存在しない契約先IDでの404表示", async ({ page }) => {
    await login(page, ADMIN);
    const response = await page.goto("/parties/nonexistent-id");

    expect(response?.status()).toBe(404);
    await page.screenshot({ path: evidence("005_存在しないID404.png"), fullPage: true });
  });

  test("TC-006 VIEWERロールでの編集・削除ボタン非表示", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto(`/parties/${fullyFilledPartyId}`);

    await expect(page.getByText("詳細表示確認商事", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "編集する" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "削除" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "一覧へ戻る" })).toBeVisible();
    await page.screenshot({
      path: evidence("006_VIEWER編集削除ボタン非表示.png"),
      fullPage: true,
    });
  });

  test("TC-007 ADMIN/OPERATORでの編集・削除ボタン表示", async ({ browser }) => {
    for (const user of [ADMIN, OPERATOR]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user);
      await page.goto(`/parties/${fullyFilledPartyId}`);

      await expect(page.getByRole("link", { name: "編集する" })).toBeVisible();
      await expect(page.getByRole("button", { name: "削除" })).toBeVisible();
      await page.screenshot({
        path: evidence(`007_ADMIN編集削除ボタン表示_${user.role}.png`),
        fullPage: true,
      });
      await context.close();
    }
  });
});
