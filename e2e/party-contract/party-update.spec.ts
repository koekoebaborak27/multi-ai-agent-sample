import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(process.cwd(), "docs/test/unit/result/party-contract/テスト結果UT_13_契約先更新");

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

// 開発者ツール相当の操作として、分類プルダウンの値を存在しないマスタIDに書き換える。
// React 19のフォーム送信はDOM上のhidden inputの値ではなく、React内部で保持している状態から
// FormDataを構築するため、DOM操作では値を変えられない。そのため送信リクエスト本文（multipart/
// form-data）の companyTypeMasterId パートを直接書き換える形で「開発者ツールでの改ざん」を再現する。
async function interceptCompanyTypeMasterIdOnce(page: Page, value: string) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const buffer = request.postDataBuffer();
    if (!buffer) return route.continue();
    const text = buffer.toString("utf-8");
    if (!/name="_\d+_companyTypeMasterId"/.test(text)) return route.continue();
    const replaced = text.replace(
      /(name="_\d+_companyTypeMasterId"\r\n\r\n)\d*(\r\n)/,
      `$1${value}$2`,
    );
    await route.continue({ postData: Buffer.from(replaced, "utf-8") });
    await page.unroute("**/*");
  });
}

test.describe.serial("契約先更新（PTY-05 / PTY-03）", () => {
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
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ createdPartyCount: createdPartyIds.length }, null, 2),
    );
    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    await prisma.$disconnect();
  });

  // 各テストケースで更新対象を新規に作り、既存データ（検証用の契約先A等）には触れない
  async function createTarget(name: string) {
    const party = await prisma.party.create({
      data: { name, companyTypeMasterId: corpMasterId, contactInfo: "更新前連絡先" },
    });
    createdPartyIds.push(party.id);
    return party;
  }

  test("TC-001 名称のみの単独更新", async ({ page }) => {
    const target = await createTarget("更新対象商事TC001");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("更新確認商事");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByText("現在の名称")).toBeVisible();
    await expect(page.getByText("更新対象商事TC001", { exact: true })).toBeVisible();
    await expect(page.getByText("更新後の名称")).toBeVisible();
    await expect(page.getByText("更新確認商事", { exact: true })).toBeVisible();
    const unchangedCount = await page.getByText("（変更なし）").count();
    expect(unchangedCount).toBe(2);
    await page.screenshot({ path: evidence("001_名称単独更新確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/parties\/[^/]+\?updated=1/, { timeout: 15000 });
    await expect(page.getByText("更新しました")).toBeVisible();
    await expect(page.getByText("更新確認商事", { exact: true }).first()).toBeVisible();
    await page.screenshot({ path: evidence("001_名称単独更新完了.png"), fullPage: true });

    const updated = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.name).toBe("更新確認商事");
    expect(updated.companyTypeMasterId).toBe(corpMasterId);
    expect(updated.contactInfo).toBe("更新前連絡先");
  });

  test("TC-002 分類のみの単独更新", async ({ page }) => {
    const target = await createTarget("更新対象商事TC002");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("combobox", { name: "分類" }).click();
    await page.getByRole("option", { name: "個人" }).click();
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("002_分類単独更新完了.png"), fullPage: true });

    const updated = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.companyTypeMasterId).toBe(indivMasterId);
    expect(updated.name).toBe("更新対象商事TC002");
    expect(updated.contactInfo).toBe("更新前連絡先");
  });

  test("TC-003 連絡先のみの単独更新", async ({ page }) => {
    const target = await createTarget("更新対象商事TC003");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "連絡先" }).fill("更新後連絡先");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("003_連絡先単独更新完了.png"), fullPage: true });

    const updated = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.contactInfo).toBe("更新後連絡先");
    expect(updated.name).toBe("更新対象商事TC003");
    expect(updated.companyTypeMasterId).toBe(corpMasterId);
  });

  test("TC-004 3項目同時更新", async ({ page }) => {
    const target = await createTarget("更新対象商事TC004");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("3項目更新確認商事");
    await page.getByRole("combobox", { name: "分類" }).click();
    await page.getByRole("option", { name: "個人" }).click();
    await page.getByRole("textbox", { name: "連絡先" }).fill("3項目更新連絡先");
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("004_3項目同時更新完了.png"), fullPage: true });

    const updated = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.name).toBe("3項目更新確認商事");
    expect(updated.companyTypeMasterId).toBe(indivMasterId);
    expect(updated.contactInfo).toBe("3項目更新連絡先");
  });

  test("TC-005 分類を未設定へ変更", async ({ page }) => {
    const target = await createTarget("更新対象商事TC005");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("combobox", { name: "分類" }).click();
    await page.getByRole("option", { name: "未設定" }).click();
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("005_分類未設定へ変更.png"), fullPage: true });

    const updated = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(updated.companyTypeMasterId).toBeNull();
  });

  test("TC-006 存在しない契約先の更新", async ({ page }) => {
    const target = await createTarget("更新対象商事TC006");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("削除される予定の更新確認商事");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    // 確認画面を表示したまま、他の利用者が先に削除した状況をDB操作で再現する
    await prisma.party.delete({ where: { id: target.id } });
    createdPartyIds.splice(createdPartyIds.indexOf(target.id), 1);

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("対象の契約先が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("006_存在しない契約先エラー.png"), fullPage: true });
  });

  test("TC-007 存在しない契約先分類マスタIDへの変更", async ({ page }) => {
    const target = await createTarget("更新対象商事TC007");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    // 分類プルダウンは存在しないマスタIDを選択できないため、開発者ツール相当の操作として
    // 「確認する」送信時のリクエスト本文にあるcompanyTypeMasterIdを直接書き換える
    await interceptCompanyTypeMasterIdOnce(page, "999999");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText("選択した内容が見つかりません。画面を更新してから選び直してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("007_存在しない分類IDエラー.png"), fullPage: true });
  });

  test("TC-008 同時更新エラー（updatedAt不一致）", async ({ page }) => {
    const target = await createTarget("更新対象商事TC008");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("同時更新確認商事");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    // 確認画面を表示したまま、他の利用者が先に更新した状況をDB操作で再現する
    await prisma.party.update({
      where: { id: target.id },
      data: { name: "先行更新済み商事" },
    });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("008_同時更新エラー.png"), fullPage: true });

    const current = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(current.name).toBe("先行更新済み商事");
  });

  test("TC-009 値を変えずに実行", async ({ page }) => {
    const target = await createTarget("更新対象商事TC009");
    const before = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    const unchangedCount = await page.getByText("（変更なし）").count();
    expect(unchangedCount).toBe(3);

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("更新しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("009_値変更なし実行成功.png"), fullPage: true });

    const after = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(after.name).toBe(before.name);
    expect(after.companyTypeMasterId).toBe(before.companyTypeMasterId);
    expect(after.contactInfo).toBe(before.contactInfo);
    expect(after.createdBy).toBe(before.createdBy);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });

  test("TC-010 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    const target = await createTarget("更新対象商事TC010");

    await login(page, VIEWER);
    await page.goto(`/parties/${target.id}/edit`);

    await expect(page).toHaveURL(new RegExp(`/parties/${target.id}(\\?|$)`));
    await page.screenshot({ path: evidence("010_VIEWER権限制御.png"), fullPage: true });
  });

  test("TC-011 「入力内容を修正」での入力値保持", async ({ page }) => {
    const target = await createTarget("更新対象商事TC011");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("修正確認後商事");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByRole("textbox", { name: "名称" })).toHaveValue("修正確認後商事");
    await page.screenshot({ path: evidence("011_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-012 「キャンセル」での破棄", async ({ page }) => {
    const target = await createTarget("更新対象商事TC012");

    await login(page, ADMIN);
    await page.goto(`/parties/${target.id}/edit`);
    await page.getByRole("textbox", { name: "名称" }).fill("キャンセル確認後商事");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(`http://localhost:3000/parties/${target.id}`);
    await page.screenshot({ path: evidence("012_キャンセルで破棄.png"), fullPage: true });

    const current = await prisma.party.findUniqueOrThrow({ where: { id: target.id } });
    expect(current.name).toBe("更新対象商事TC012");
  });
});
