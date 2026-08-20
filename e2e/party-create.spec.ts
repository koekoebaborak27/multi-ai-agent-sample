import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/テスト結果UT_11_契約先新規登録",
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

test.describe.serial("契約先新規登録（PTY-02 / PTY-03）", () => {
  // このテストで登録に成功したPartyのIDを記録し、afterAllでまとめて削除する
  const createdPartyIds: string[] = [];
  let contractTypeMasterId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    // TC-005用: 契約先分類ではない分類コード（CONTRACT_TYPE）配下のマスタID
    const contractTypeMaster = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_TYPE" } },
    });
    contractTypeMasterId = contractTypeMaster.id;
  });

  test.afterAll(async () => {
    fs.writeFileSync(
      evidence("db_after.json"),
      JSON.stringify({ createdPartyCount: createdPartyIds.length }, null, 2),
    );
    await prisma.party.deleteMany({ where: { id: { in: createdPartyIds } } });
    await prisma.$disconnect();
  });

  test("TC-001 名称のみでの登録完了（確認画面の表示項目を含む）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("新規登録確認商事");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText("処理内容")).toBeVisible();
    await expect(page.getByText("新規登録", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後の名称")).toBeVisible();
    await expect(page.getByText("新規登録確認商事", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後の分類")).toBeVisible();
    await expect(page.getByText("未設定", { exact: true })).toBeVisible();
    await expect(page.getByText("登録後の連絡先")).toBeVisible();
    await expect(page.getByText("現在の名称")).toHaveCount(0);
    await page.screenshot({ path: evidence("001_新規登録確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page).toHaveURL(/\/parties\/[^/]+\?created=1/, { timeout: 15000 });
    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("001_新規登録完了後詳細画面.png"), fullPage: true });

    const created = await prisma.party.findFirstOrThrow({
      where: { name: "新規登録確認商事" },
    });
    createdPartyIds.push(created.id);
    expect(created.companyTypeMasterId).toBeNull();
    expect(created.contactInfo).toBeNull();
    expect(created.createdBy).toBe(ADMIN.id);
    expect(created.updatedBy).toBe(ADMIN.id);
  });

  test("TC-002 分類・連絡先を含めた全項目での登録", async ({ page }) => {
    const companyTypeMaster = await prisma.master.findFirstOrThrow({
      where: { category: { code: "CONTRACT_COMPANY_TYPE" }, content: "法人" },
    });

    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("全項目登録確認商事");
    await page.getByRole("combobox", { name: "分類" }).click();
    await page.getByRole("option", { name: "法人" }).click();
    await page.getByRole("textbox", { name: "連絡先" }).fill("03-1234-5678");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    await expect(page.getByText("法人", { exact: true })).toBeVisible();
    await expect(page.getByText("03-1234-5678", { exact: true })).toBeVisible();
    await page.screenshot({ path: evidence("002_全項目登録完了.png"), fullPage: true });

    const created = await prisma.party.findFirstOrThrow({
      where: { name: "全項目登録確認商事" },
    });
    createdPartyIds.push(created.id);
    expect(created.companyTypeMasterId).toBe(companyTypeMaster.id);
    expect(created.contactInfo).toBe("03-1234-5678");
  });

  test("TC-003 名称未入力での確認", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    // 名称欄にはHTML5のrequired属性があり、空のまま送信するとブラウザのネイティブ検証で
    // 止まってしまいサーバー側の検証まで届かないため、検証対象のサーバー側エラーを確認するには外す
    await page
      .getByRole("textbox", { name: "名称" })
      .evaluate((el) => el.removeAttribute("required"));
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("名称は必須です")).toBeVisible();
    await page.screenshot({ path: evidence("003_名称未入力エラー.png"), fullPage: true });
  });

  test("TC-004 存在しない契約先分類マスタIDの指定", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("存在しない分類ID確認商事");
    // 開発者ツール相当の操作として、hidden inputの値を直接書き換える
    await page.evaluate(() => {
      const input = document.querySelector<HTMLInputElement>('input[name="companyTypeMasterId"]');
      if (input) input.value = "999999";
    });
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText("選択した内容が見つかりません。画面を更新してから選び直してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("004_存在しない分類IDエラー.png"), fullPage: true });
  });

  test("TC-005 契約先分類以外の分類コード配下のマスタIDの指定", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("分類コード不一致確認商事");
    await page.evaluate((id) => {
      const input = document.querySelector<HTMLInputElement>('input[name="companyTypeMasterId"]');
      if (input) input.value = String(id);
    }, contractTypeMasterId);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(
      page.getByText("選択した内容が見つかりません。画面を更新してから選び直してください"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("005_分類コード不一致エラー.png"), fullPage: true });
  });

  test("TC-006 名称200文字での登録", async ({ page }) => {
    const name = "検証200文字".repeat(1).padEnd(200, "あ");
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill(name);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await page.getByRole("button", { name: "実行" }).click();

    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("006_名称200文字登録成功.png"), fullPage: true });

    const created = await prisma.party.findFirstOrThrow({ where: { name } });
    createdPartyIds.push(created.id);
    expect(created.name.length).toBe(200);
  });

  test("TC-007 名称201文字での登録拒否", async ({ page }) => {
    const name = "検証201文字".padEnd(201, "あ");
    await login(page, ADMIN);
    await page.goto("/parties/new");
    const nameInput = page.getByRole("textbox", { name: "名称" });
    await nameInput.evaluate((el) => el.removeAttribute("maxlength"));
    await nameInput.fill(name);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("名称は200文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("007_名称201文字登録拒否.png"), fullPage: true });
  });

  test("TC-008 連絡先500文字／501文字での登録", async ({ page }) => {
    const contact500 = "連絡先確認".padEnd(500, "1");
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("連絡先500文字確認商事");
    await page.getByRole("textbox", { name: "連絡先" }).fill(contact500);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: evidence("008_連絡先500文字登録成功.png"), fullPage: true });

    const created = await prisma.party.findFirstOrThrow({
      where: { name: "連絡先500文字確認商事" },
    });
    createdPartyIds.push(created.id);
    expect(created.contactInfo?.length).toBe(500);

    const contact501 = "連絡先確認".padEnd(501, "1");
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("連絡先501文字確認商事");
    const contactInput = page.getByRole("textbox", { name: "連絡先" });
    await contactInput.evaluate((el) => el.removeAttribute("maxlength"));
    await contactInput.fill(contact501);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("連絡先は500文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("008_連絡先501文字登録拒否.png"), fullPage: true });
  });

  test("TC-009 「入力内容を修正」での入力値保持", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("修正確認商事");
    await page.getByRole("combobox", { name: "分類" }).click();
    await page.getByRole("option", { name: "法人" }).click();
    await page.getByRole("textbox", { name: "連絡先" }).fill("修正確認連絡先");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByRole("textbox", { name: "名称" })).toHaveValue("修正確認商事");
    await expect(page.getByRole("combobox", { name: "分類" })).toContainText("法人");
    await expect(page.getByRole("textbox", { name: "連絡先" })).toHaveValue("修正確認連絡先");
    await page.screenshot({ path: evidence("009_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-010 「キャンセル」での破棄", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/parties/new");
    await page.getByRole("textbox", { name: "名称" }).fill("キャンセル確認商事");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL("http://localhost:3000/parties");
    await page.screenshot({ path: evidence("010_キャンセルで破棄.png"), fullPage: true });

    const found = await prisma.party.findFirst({ where: { name: "キャンセル確認商事" } });
    expect(found).toBeNull();
  });

  test("TC-011 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto("/parties/new");

    await expect(page).toHaveURL("http://localhost:3000/parties");
    await page.screenshot({ path: evidence("011_VIEWER権限制御.png"), fullPage: true });
  });

  test("TC-012 契約先分類0件時の案内表示", async ({ page }) => {
    // CONTRACT_COMPANY_TYPE配下は分類コードがユニークなため、0件を再現するには
    // 既存のマスタ（法人/個人）を一時的に削除するしかない。内容を退避し、テスト後に復元する。
    const masters = await prisma.master.findMany({
      where: { category: { code: "CONTRACT_COMPANY_TYPE" } },
    });
    const partiesReferencing = await prisma.party.findMany({
      where: { companyTypeMasterId: { in: masters.map((m) => m.id) } },
      select: { id: true, companyTypeMasterId: true },
    });
    const category = await prisma.masterCategory.findFirstOrThrow({
      where: { code: "CONTRACT_COMPANY_TYPE" },
    });

    await prisma.master.deleteMany({ where: { id: { in: masters.map((m) => m.id) } } });

    try {
      await login(page, ADMIN);
      await page.goto("/parties/new");

      await expect(page.getByText("未設定（契約先分類マスタが未登録です）")).toBeVisible();
      await expect(page.getByRole("button", { name: "確認する" })).toBeEnabled();
      await page.screenshot({ path: evidence("012_分類0件時案内表示.png"), fullPage: true });

      await page.getByRole("textbox", { name: "名称" }).fill("分類0件時登録確認商事");
      await page.getByRole("button", { name: "確認する" }).click();
      await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
      await page.getByRole("button", { name: "実行" }).click();
      await expect(page.getByText("登録しました")).toBeVisible({ timeout: 15000 });

      const created = await prisma.party.findFirstOrThrow({
        where: { name: "分類0件時登録確認商事" },
      });
      createdPartyIds.push(created.id);
    } finally {
      // 削除したマスタを同じcode/nameで復元し、既存Partyの参照を新しいIDへ再接続する
      const idMap = new Map<number, number>();
      for (const m of masters) {
        const restored = await prisma.master.create({
          data: { categoryId: category.id, code: m.code, content: m.content },
        });
        idMap.set(m.id, restored.id);
      }
      for (const p of partiesReferencing) {
        const newId = idMap.get(p.companyTypeMasterId!);
        if (newId) {
          await prisma.party.update({
            where: { id: p.id },
            data: { companyTypeMasterId: newId },
          });
        }
      }
    }
  });
});
