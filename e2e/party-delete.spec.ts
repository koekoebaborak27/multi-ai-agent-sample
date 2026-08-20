import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(process.cwd(), "docs/test/unit/result/テスト結果UT_14_契約先削除");

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

test.describe.serial("契約先削除（PTY-04 の削除確認ダイアログ）", () => {
  // 万一の不具合で既存データ（検証用の契約先A・検証用の契約）を壊さないよう、
  // 各テストケース専用の一時Party・Contractを作成して検証する
  const createdPartyIds: string[] = [];
  let deletedPartyId: string; // TC-001で削除し、TC-005の404確認で再利用する

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ createdPartyCount: createdPartyIds.length }, null, 2),
    );
    // 契約→契約先の順で片付ける（外部キー: Contract.partyId → Party.id）
    await prisma.contract.deleteMany({ where: { partyId: { in: createdPartyIds } } });
    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    await prisma.$disconnect();
  });

  async function createParty(name: string) {
    const party = await prisma.party.create({ data: { name } });
    createdPartyIds.push(party.id);
    return party;
  }

  test("TC-001 紐づく契約が無い契約先の削除完了（ダイアログ表示項目を含む）", async ({ page }) => {
    const party = await createParty("削除確認商事TC001");

    await login(page, ADMIN);
    await page.goto(`/parties/${party.id}`);
    await page.getByRole("button", { name: "削除" }).click();

    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByRole("heading", { name: "契約先を削除しますか？" })).toBeVisible();
    await expect(dialog.getByText(party.name, { exact: true })).toBeVisible();
    await expect(dialog.getByText("削除した契約先は元に戻せません。")).toBeVisible();
    await expect(
      dialog.getByText("紐づく契約が1件でも存在する場合は削除できません。"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("001_削除確認ダイアログ.png"), fullPage: true });

    await dialog.getByRole("button", { name: "削除する" }).click();
    await expect(page).toHaveURL(/\/parties(\?.*deleted=1)?$/, { timeout: 15000 });
    await expect(page.getByText("削除しました").first()).toBeVisible();
    await page.screenshot({ path: evidence("001_削除完了後一覧.png"), fullPage: true });

    const remaining = await prisma.party.findUnique({ where: { id: party.id } });
    expect(remaining).toBeNull();
    deletedPartyId = party.id;
  });

  test("TC-002 紐づく契約が存在する場合の削除拒否", async ({ page }) => {
    const party = await createParty("削除確認商事TC002");
    await prisma.contract.create({
      data: { partyId: party.id, title: "削除拒否確認用契約" },
    });

    await login(page, ADMIN);
    await page.goto(`/parties/${party.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();

    await expect(
      page.getByText(
        "この契約先には1件の契約が登録されているため削除できません。先に契約を削除してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("002_紐づく契約有り削除拒否.png"), fullPage: true });

    const remaining = await prisma.party.findUnique({ where: { id: party.id } });
    expect(remaining).not.toBeNull();
  });

  test("TC-003 存在しない契約先の削除", async ({ page }) => {
    const party = await createParty("削除確認商事TC003");

    await login(page, ADMIN);
    await page.goto(`/parties/${party.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // ダイアログを表示したまま、他の利用者が先に削除した状況をDB操作で再現する
    await prisma.party.delete({ where: { id: party.id } });
    createdPartyIds.splice(createdPartyIds.indexOf(party.id), 1);

    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(page.getByText("対象の契約先が見つかりません")).toBeVisible();
    await page.screenshot({ path: evidence("003_存在しない契約先エラー.png"), fullPage: true });
  });

  test("TC-004 同時更新エラー（updatedAt不一致）", async ({ page }) => {
    const party = await createParty("削除確認商事TC004");

    await login(page, ADMIN);
    await page.goto(`/parties/${party.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // ダイアログを表示したまま、他の利用者が先に更新した状況をDB操作で再現する
    await prisma.party.update({ where: { id: party.id }, data: { name: "先行更新済み商事" } });

    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_同時更新エラー.png"), fullPage: true });

    const remaining = await prisma.party.findUnique({ where: { id: party.id } });
    expect(remaining).not.toBeNull();
    expect(remaining?.name).toBe("先行更新済み商事");
  });

  test("TC-005 削除した契約先の詳細取得が404になる", async ({ page }) => {
    await login(page, ADMIN);
    const response = await page.goto(`/parties/${deletedPartyId}`);

    expect(response?.status()).toBe(404);
    await page.screenshot({ path: evidence("005_削除後404.png"), fullPage: true });
  });

  test("TC-006 検証順序（存在→同時更新→紐づく契約件数）", async ({ page }) => {
    const party = await createParty("削除確認商事TC006");
    await prisma.contract.create({
      data: { partyId: party.id, title: "検証順序確認用契約" },
    });

    await login(page, ADMIN);
    await page.goto(`/parties/${party.id}`);
    await page.getByRole("button", { name: "削除" }).click();
    await expect(page.getByRole("alertdialog")).toBeVisible();

    // updatedAtが異なる状態（同時更新）かつ紐づく契約が存在する状態にする
    await prisma.party.update({ where: { id: party.id }, data: { name: "検証順序更新後商事" } });

    await page.getByRole("alertdialog").getByRole("button", { name: "削除する" }).click();
    // 紐づく契約の件数チェックより先に同時更新エラーが返ることを確認する
    await expect(
      page.getByText("ほかの利用者によって更新されています。最新の内容を確認してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("006_検証順序確認.png"), fullPage: true });

    const remaining = await prisma.party.findUnique({ where: { id: party.id } });
    expect(remaining).not.toBeNull();
  });
});
