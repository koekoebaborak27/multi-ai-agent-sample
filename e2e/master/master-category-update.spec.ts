import fs from "node:fs";
import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/master/テスト結果UT_23_マスタ分類更新",
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

test.describe.serial("マスタ分類更新（MST-10 / MST-09）", () => {
  const duplicateName = "分類名重複確認用（更新）";
  const createdNames: string[] = [];
  let targetId: number;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
    await prisma.masterCategory.create({ data: { name: duplicateName } });

    const before = await prisma.masterCategory.findMany({ orderBy: { id: "asc" } });
    fs.writeFileSync(
      evidence("db_before_MasterCategory.json"),
      JSON.stringify(
        before.map((c) => ({ name: c.name })),
        null,
        2,
      ),
    );
  });

  test.afterAll(async () => {
    const after = await prisma.masterCategory.findMany({ orderBy: { id: "asc" } });
    fs.writeFileSync(
      evidence("db_after_MasterCategory.json"),
      JSON.stringify(
        after.map((c) => ({ name: c.name })),
        null,
        2,
      ),
    );

    await prisma.masterCategory.deleteMany({
      where: { name: { in: [duplicateName, ...createdNames, "更新対象分類"] } },
    });
    await prisma.$disconnect();
  });

  test.beforeEach(async () => {
    // 各テストケースで更新対象分類を作り直し、他のケースの結果に影響されないようにする
    const target = await prisma.masterCategory.upsert({
      where: { name: "更新対象分類" },
      update: {},
      create: { name: "更新対象分類", createdBy: "admin", updatedBy: "admin" },
    });
    targetId = target.id;
  });

  test("TC-001 分類名変更での更新完了（確認画面の表示項目を含む）", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill("更新後分類名");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    await expect(page.getByText("更新", { exact: true })).toBeVisible();
    await expect(page.getByText("現在のマスタ分類名")).toBeVisible();
    await expect(page.getByText("更新対象分類", { exact: true })).toBeVisible();
    await expect(page.getByText("更新後のマスタ分類名")).toBeVisible();
    await expect(page.getByText("更新後分類名", { exact: true })).toBeVisible();
    await expect(page.getByText("登録マスタ件数")).toBeVisible();
    await page.screenshot({ path: evidence("001_更新確認画面.png"), fullPage: true });

    await page.getByRole("button", { name: "実行" }).click();
    await expect(
      page.getByText("システムで利用されているコードのため、編集・削除には十分注意してください。"),
    ).toBeVisible();
    await page.screenshot({ path: evidence("001_警告ダイアログ.png"), fullPage: true });
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${targetId}?updated=1`);
    await expect(page.getByText("更新しました")).toBeVisible();
    await expect(page.getByText("更新後分類名", { exact: true })).toBeVisible();
    createdNames.push("更新後分類名");
    await page.screenshot({ path: evidence("001_更新完了後詳細画面.png"), fullPage: true });
  });

  test("TC-002 名称を変えずに更新する", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await page.getByRole("button", { name: "OK" }).click();

    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${targetId}?updated=1`);
    await expect(page.getByText("更新しました")).toBeVisible();
    await page.screenshot({ path: evidence("002_名称変更なし更新.png"), fullPage: true });
  });

  test("TC-003 確認画面遷移時の名称重複", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill(duplicateName);
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("同じ名前のマスタ分類が登録されています")).toBeVisible();
    await page.screenshot({ path: evidence("003_確認画面遷移時重複エラー.png"), fullPage: true });
  });

  test("TC-004 実行時点の名称重複", async ({ page }) => {
    const name = "実行時重複確認分類（更新）";

    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill(name);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await prisma.masterCategory.create({ data: { name } });
    createdNames.push(name);

    await page.getByRole("button", { name: "実行" }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page.getByText("同じ名前のマスタ分類が登録されています")).toBeVisible();
    await page.screenshot({ path: evidence("004_実行時重複エラー.png"), fullPage: true });

    const current = await prisma.masterCategory.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.name).toBe("更新対象分類");
  });

  test("TC-005 同時更新エラー", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill("同時更新確認分類");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    // 確認画面を表示したまま、他の利用者が先に更新した状況をDB操作で再現する
    await prisma.masterCategory.update({
      where: { id: targetId },
      data: { name: "先行更新済み分類" },
    });
    createdNames.push("先行更新済み分類");

    await page.getByRole("button", { name: "実行" }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(
      page.getByText(
        "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      ),
    ).toBeVisible();
    await page.screenshot({ path: evidence("005_同時更新エラー.png"), fullPage: true });
  });

  test("TC-006 分類名30文字／31文字での更新", async ({ page }) => {
    const name30 = "う".repeat(30);
    const name31 = "え".repeat(31);
    createdNames.push(name30);

    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill(name30);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await page.getByRole("button", { name: "OK" }).click();
    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${targetId}?updated=1`);
    await expect(page.getByText("更新しました")).toBeVisible();
    await page.screenshot({ path: evidence("006_30文字更新成功.png"), fullPage: true });

    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill(name31);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ分類名は30文字以内です")).toBeVisible();
    await page.screenshot({ path: evidence("006_31文字更新拒否.png"), fullPage: true });
  });

  test("TC-007 分類名未入力での確認", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill("   ");
    await page.getByRole("button", { name: "確認する" }).click();

    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toHaveCount(0);
    await expect(page.getByText("マスタ分類名は必須です")).toBeVisible();
    await page.screenshot({ path: evidence("007_未入力エラー.png"), fullPage: true });
  });

  test("TC-008 VIEWERロールでの画面アクセス制御", async ({ page }) => {
    await login(page, VIEWER);
    await page.goto(`/master/categories/${targetId}/edit`);

    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${targetId}`);
    await page.screenshot({ path: evidence("008_VIEWER権限制御.png"), fullPage: true });
  });

  test("TC-009 「入力内容を修正」での入力値保持", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill("修正確認更新分類");
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "入力内容を修正" }).click();
    await expect(page.getByLabel("マスタ分類名")).toHaveValue("修正確認更新分類");
    await page.screenshot({ path: evidence("009_修正で入力値保持.png"), fullPage: true });
  });

  test("TC-010 「キャンセル」での破棄", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByLabel("マスタ分類名").fill("キャンセル確認更新分類");
    await page.getByRole("link", { name: "キャンセル" }).click();

    await expect(page).toHaveURL(`http://localhost:3000/master/categories/${targetId}`);
    const current = await prisma.masterCategory.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.name).toBe("更新対象分類");
    await page.screenshot({ path: evidence("010_キャンセルで破棄.png"), fullPage: true });
  });

  test("TC-011 「実行」ボタン押下時の警告確認ダイアログの表示内容と初期フォーカス", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByRole("button", { name: "確認する" }).click();
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();

    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByRole("heading", { name: "マスタ分類を更新しますか？" })).toBeVisible();
    await expect(
      page.getByText("システムで利用されているコードのため、編集・削除には十分注意してください。"),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "キャンセル" }).last()).toBeFocused();
    await page.screenshot({ path: evidence("011_実行警告ダイアログ表示.png"), fullPage: true });
  });

  test("TC-012 「実行」ボタン押下時の警告確認ダイアログのキャンセル動作", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto(`/master/categories/${targetId}/edit`);
    await page.getByRole("button", { name: "確認する" }).click();
    await page.getByRole("button", { name: "実行" }).click();
    await expect(page.getByRole("heading", { name: "マスタ分類を更新しますか？" })).toBeVisible();

    await page.getByRole("button", { name: "キャンセル" }).last().click();
    await expect(page.getByRole("heading", { name: "マスタ分類を更新しますか？" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "入力内容の確認" })).toBeVisible();
    const current = await prisma.masterCategory.findUniqueOrThrow({ where: { id: targetId } });
    expect(current.name).toBe("更新対象分類");
    await page.screenshot({
      path: evidence("012_実行警告ダイアログキャンセル.png"),
      fullPage: true,
    });
  });
});
