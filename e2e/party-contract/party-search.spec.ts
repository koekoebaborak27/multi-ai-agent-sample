import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/party-contract/テスト結果UT_10_契約先検索一覧",
);

function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = {
  id: "admin",
  role: "ADMIN",
  password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
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

const KEYWORD_PARTY_NAME = "検索確認商事";
const CATEGORY_PARTY_NAME = "分類絞り込み確認用商事";
const AND_PARTY_NAME = "AND確認商事";
const UNSET_PARTY_NAME = "分類未設定確認商事";
const PAGING_EXTRA_COUNT = 27; // 上記4件と合わせて31件（PAGE_SIZE=30超え）にする

test.describe.serial("契約先検索一覧（PTY-01）", () => {
  // 一時作成した契約先のIDだけを記録し、既存データ（検証用の契約先A等）には触れない
  const createdPartyIds: string[] = [];
  let corpMasterId: number;
  let indivMasterId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const corpMaster = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_COMPANY_TYPE" }, content: "法人" },
    });
    corpMasterId = corpMaster.id;
    const indivMaster = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_COMPANY_TYPE" }, content: "個人" },
    });
    indivMasterId = indivMaster.id;

    const keywordParty = await prisma.party.create({
      data: { name: KEYWORD_PARTY_NAME, companyTypeMasterId: corpMasterId },
    });
    const categoryParty = await prisma.party.create({
      data: { name: CATEGORY_PARTY_NAME, companyTypeMasterId: indivMasterId },
    });
    const andParty = await prisma.party.create({
      data: { name: AND_PARTY_NAME, companyTypeMasterId: indivMasterId },
    });
    const unsetParty = await prisma.party.create({
      data: { name: UNSET_PARTY_NAME, companyTypeMasterId: null },
    });
    createdPartyIds.push(keywordParty.id, categoryParty.id, andParty.id, unsetParty.id);

    for (let i = 1; i <= PAGING_EXTRA_COUNT; i++) {
      const p = await prisma.party.create({
        data: {
          name: `ページング確認用商事${String(i).padStart(3, "0")}`,
          companyTypeMasterId: corpMasterId,
        },
      });
      createdPartyIds.push(p.id);
    }

    fs.writeFileSync(
      evidence("db_before.json"),
      JSON.stringify({ createdCount: createdPartyIds.length }, null, 2),
    );
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ createdCount: createdPartyIds.length }, null, 2),
    );
    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    await prisma.$disconnect();
  });

  test("TC-001 名称キーワードの部分一致検索", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");
    await page.getByRole("textbox", { name: "名称" }).fill("検索確認");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page).toHaveURL(/keyword=/);
    await expect(page.getByRole("cell", { name: KEYWORD_PARTY_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: CATEGORY_PARTY_NAME, exact: true })).toHaveCount(0);
    await page.screenshot({ path: evidence("001_名称部分一致検索結果.png"), fullPage: true });
  });

  test("TC-002 契約先分類での絞り込み", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/parties?companyTypeId=${indivMasterId}`);

    await expect(page.getByRole("cell", { name: CATEGORY_PARTY_NAME, exact: true })).toBeVisible();
    await expect(page.getByRole("cell", { name: KEYWORD_PARTY_NAME, exact: true })).toHaveCount(0);
    await page.screenshot({ path: evidence("002_分類絞り込み結果.png"), fullPage: true });
  });

  test("TC-003 名称と契約先分類のAND条件検索", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");
    await page.getByRole("textbox", { name: "名称" }).fill("AND確認");
    await page.getByRole("combobox", { name: "契約先分類" }).click();
    await page.getByRole("option", { name: "個人" }).click();
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByRole("cell", { name: AND_PARTY_NAME, exact: true })).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(1);
    await page.screenshot({ path: evidence("003_AND条件検索結果.png"), fullPage: true });
  });

  test("TC-004 検索条件未指定時の全件表示（分類未設定を含む）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");

    await expect(page.getByText(`検索結果 全${createdPartyIds.length + 1}件`)).toBeVisible();
    await page.getByRole("textbox", { name: "名称" }).fill("分類未設定確認");
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await expect(page.getByRole("cell", { name: "未設定", exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("004_全件表示.png"), fullPage: true });
  });

  test("TC-005 ページング", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");

    await expect(page.getByText("（1 / ")).toBeVisible();
    await page.screenshot({ path: evidence("005_ページング確認_1ページ目.png"), fullPage: true });

    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.getByText("（2 / ")).toBeVisible();
    await page.screenshot({ path: evidence("005_ページング確認_2ページ目.png"), fullPage: true });
  });

  test("TC-006 名称の昇順・降順並び替え", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");

    // 既定が名称昇順のため、まず降順に切り替える
    await page.getByRole("link", { name: "名称を降順で並べ替える" }).click();
    await expect(page).toHaveURL(/sort=name&order=desc/);
    await page.screenshot({ path: evidence("006_名称並び替え_降順.png"), fullPage: true });

    await page.getByRole("link", { name: "名称を昇順で並べ替える" }).click();
    await expect(page).toHaveURL(/order=asc&sort=name/);
    await page.screenshot({ path: evidence("006_名称並び替え_昇順.png"), fullPage: true });
  });

  test("TC-007 検索条件変更でページ番号が1へ戻る", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties?page=2");
    await expect(page.getByText("（2 / ")).toBeVisible();

    await page.getByRole("textbox", { name: "名称" }).fill("ページング確認用商事001");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page).not.toHaveURL(/page=2/);
    await expect(page.getByText("（1 / ")).toBeVisible();
    await page.screenshot({ path: evidence("007_検索でページ1へ.png"), fullPage: true });
  });

  test("TC-008 「条件をクリア」で初期状態へ戻る", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");
    await page.getByRole("textbox", { name: "名称" }).fill("検索確認");
    await page.getByRole("combobox", { name: "契約先分類" }).click();
    await page.getByRole("option", { name: "法人" }).click();
    await page.getByRole("button", { name: "検索", exact: true }).click();
    await page.getByRole("link", { name: "次へ" }).click();
    await expect(page).toHaveURL(/page=2/);

    await page.getByRole("button", { name: "条件をクリア" }).click();

    await expect(page).toHaveURL("http://localhost:3000/parties");
    await expect(page.getByRole("textbox", { name: "名称" })).toHaveValue("");
    await expect(page.getByRole("combobox", { name: "契約先分類" })).toContainText("すべて");
    await page.screenshot({ path: evidence("008_条件クリア.png"), fullPage: true });
  });

  test("TC-009 VIEWERロールでの新規登録ボタン非表示", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/parties");

    await expect(page.getByText(/検索結果 全\d+件/)).toBeVisible();
    await expect(page.getByRole("link", { name: "新規登録" })).toHaveCount(0);
    await page.screenshot({
      path: evidence("009_VIEWER新規登録ボタン非表示.png"),
      fullPage: true,
    });
  });

  test("TC-010 検索結果0件時のメッセージ", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties");
    await page.getByRole("textbox", { name: "名称" }).fill("存在しない契約先名XYZ");
    await page.getByRole("button", { name: "検索", exact: true }).click();

    await expect(page.getByText("該当する契約先がありません")).toBeVisible();
    await page.screenshot({ path: evidence("010_検索結果0件.png"), fullPage: true });
  });
});
