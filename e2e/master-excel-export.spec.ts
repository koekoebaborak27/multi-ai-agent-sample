import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { test, expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";

const execFileAsync = promisify(execFile);
const prisma = new PrismaClient();

const EVIDENCE_DIR = path.join(
  process.cwd(),
  "docs/test/unit/result/テスト結果UT_30_マスタ情報Excel取得",
);
function evidence(name: string) {
  return path.join(EVIDENCE_DIR, name);
}

const ADMIN = { id: "admin", password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123" };
const VIEWER = { id: "viwTest", password: process.env.SEED_VIEWER_PASSWORD ?? "test@123" };

async function login(page: Page, user: { id: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

// worker（単発モード）を1回だけ動かし、順番待ちの列に溜まっている依頼をすべて処理してから終了させる。
// `pnpm worker` は .env（本番Supabase向け）だけを読む固定設定のため、ここでは
// .env → .env.local の順で明示的に渡し、ローカルDB・ローカルストレージへ確実に接続させる。
async function runWorkerOnce() {
  await execFileAsync(
    "pnpm",
    [
      "exec",
      "tsx",
      "--env-file-if-exists=.env",
      "--env-file-if-exists=.env.local",
      "src/worker/index.ts",
      "--once",
    ],
    { cwd: process.cwd(), shell: true, timeout: 60_000 },
  );
}

// 境界値確認用のテストデータ（TC-005）。文字数は実際に生成して確認するため、決め打ちの文字列ではなく
// 決まった文字数になるようプログラムで組み立てる（手作業での文字数カウント間違いを防ぐため）。
const CATEGORY_NAME_PREFIX = "境界値確認分類";
const CATEGORY_NAME_30 = CATEGORY_NAME_PREFIX + "9".repeat(30 - CATEGORY_NAME_PREFIX.length);
const MASTER_CODE_8 = "MAXCODE8";
const CONTENT_PREFIX = "境界値確認内容";
const MASTER_CONTENT_30 = CONTENT_PREFIX + "9".repeat(30 - CONTENT_PREFIX.length);

test.describe.serial("マスタ情報Excel取得（MST-11）", () => {
  let boundaryCategoryId: number;
  let exportId: string;

  test.beforeAll(async () => {
    fs.mkdirSync(EVIDENCE_DIR, { recursive: true });

    const before = await prisma.masterExcelExport.findMany({ orderBy: { createdAt: "asc" } });
    fs.writeFileSync(
      evidence("db_before_master_excel_export.json"),
      JSON.stringify(before, null, 2),
    );

    // TC-005用の境界値データ（マスタ分類名30文字ちょうど、マスタコード8文字・マスタ内容30文字ちょうど）。
    // 既存データの登録者・最終更新者はすでにnullのため、NULL値の確認には新規データを追加しない。
    const category = await prisma.masterCategory.create({
      data: { name: CATEGORY_NAME_30, createdBy: ADMIN.id, updatedBy: ADMIN.id },
    });
    boundaryCategoryId = category.id;
    await prisma.master.create({
      data: {
        categoryId: boundaryCategoryId,
        code: MASTER_CODE_8,
        content: MASTER_CONTENT_30,
        createdBy: ADMIN.id,
        updatedBy: ADMIN.id,
      },
    });
  });

  test.afterAll(async () => {
    // 境界値確認用に作った分類・マスタは、このテストの中だけで使う純粋な仮データのため、
    // 再実行時に一意制約へ引っかからないよう常に片付ける
    // （MasterExcelExportの実行履歴・生成ファイルの後始末は手順8でユーザーに確認する）。
    await prisma.master.deleteMany({ where: { categoryId: boundaryCategoryId } });
    await prisma.masterCategory.delete({ where: { id: boundaryCategoryId } });

    const after = await prisma.masterExcelExport.findMany({ orderBy: { createdAt: "asc" } });
    fs.writeFileSync(evidence("db_after_master_excel_export.json"), JSON.stringify(after, null, 2));
    await prisma.$disconnect();
  });

  test("TC-001 実行履歴0件時の表示", async ({ page }) => {
    const count = await prisma.masterExcelExport.count();
    expect(count).toBe(0);

    await login(page, ADMIN);
    await page.goto("/master/exports");

    await expect(page.getByText("まだ実行履歴がありません")).toBeVisible();
    await expect(page.getByRole("button", { name: "Excelを作成する" })).toBeEnabled();
    await page.screenshot({ path: evidence("001_実行履歴0件表示.png"), fullPage: true });
  });

  test("TC-002 Excel作成の依頼と即時応答", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/exports");

    await page.getByRole("button", { name: "Excelを作成する" }).click();

    const row = page.locator("tbody tr").filter({ hasText: "受付済み" }).first();
    await expect(row).toBeVisible();
    await page.screenshot({ path: evidence("002_Excel作成依頼受付済み表示.png"), fullPage: true });

    const latest = await prisma.masterExcelExport.findFirst({
      where: { requestedBy: ADMIN.id },
      orderBy: { createdAt: "desc" },
    });
    expect(latest?.status).toBe("QUEUED");
    expect(latest?.filePath).toBeNull();
    exportId = latest!.id;
  });

  test("TC-003 未完了（受付済み）履歴のダウンロードURL直接アクセス", async ({ page }) => {
    // workerをまだ一度も動かしていないため、TC-002で作った行はQUEUEDのまま進んでいない
    const current = await prisma.masterExcelExport.findUnique({ where: { id: exportId } });
    expect(current?.status).toBe("QUEUED");

    // Playwrightはテストごとに新しいブラウザコンテキストを使うため、ログイン状態は引き継がれない
    await login(page, ADMIN);
    const response = await page.goto(`/api/master/exports/${exportId}/download`);
    expect(response?.status()).toBe(404);
    const body = await response?.json();
    expect(body?.error?.code).toBe("MASTER_EXCEL_EXPORT_NOT_FOUND");
    await page.screenshot({
      path: evidence("003_未完了履歴への直接アクセス404.png"),
      fullPage: true,
    });
  });

  test("TC-004 worker処理後の状態自動更新", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/exports");

    // 処理前は「受付済み」のまま画面を開いておき、10秒間隔の自動更新が実際に
    // 状態を反映することを確認する（手動リロードはしない）
    const row = page.locator("tbody tr").filter({ hasText: "受付済み" }).first();
    await expect(row).toBeVisible();

    await runWorkerOnce();

    const downloadLink = page.locator(`a[href="/api/master/exports/${exportId}/download"]`);
    await expect(downloadLink).toBeVisible({ timeout: 20_000 });

    const completedRow = downloadLink.locator("xpath=ancestor::tr");
    await expect(completedRow).toContainText("完了");
    await expect(completedRow).toContainText(/分類\s*\d+件\s*\/\s*マスタ\s*\d+件/);
    await page.screenshot({
      path: evidence("004_worker処理後の状態自動更新.png"),
      fullPage: true,
    });

    const record = await prisma.masterExcelExport.findUnique({ where: { id: exportId } });
    expect(record?.status).toBe("READY");
    expect(record?.startedAt).not.toBeNull();
    expect(record?.finishedAt).not.toBeNull();
    expect(record?.filePath).not.toBeNull();
    expect(record?.expiresAt).not.toBeNull();
  });

  test("TC-005 ダウンロードしたExcelファイルの中身確認", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master/exports");

    const downloadLink = page.locator(`a[href="/api/master/exports/${exportId}/download"]`);
    const downloadPromise = page.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^master_info_\d{14}\.xlsx$/);
    const savedPath = evidence("005_ダウンロードしたExcelファイル.xlsx");
    await download.saveAs(savedPath);
    await page.screenshot({ path: evidence("005_Excelファイル中身確認.png"), fullPage: true });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(savedPath);

    expect(workbook.worksheets.map((s) => s.name)).toEqual(["マスタ分類", "マスタ"]);

    const categorySheet = workbook.getWorksheet("マスタ分類")!;
    const categoryHeaderRow = categorySheet.getRow(2).values as unknown[];
    expect(categoryHeaderRow.slice(1)).toEqual([
      "マスタ分類コード",
      "マスタ分類名",
      "登録マスタ件数",
      "登録日時",
      "登録者",
      "最終更新日時",
      "最終更新者",
    ]);

    const masterSheet = workbook.getWorksheet("マスタ")!;
    const masterHeaderRow = masterSheet.getRow(2).values as unknown[];
    expect(masterHeaderRow.slice(1)).toEqual([
      "マスタ分類コード",
      "マスタ分類名",
      "マスタID",
      "マスタコード",
      "マスタ内容",
      "登録日時",
      "登録者",
      "最終更新日時",
      "最終更新者",
    ]);

    // 分類コードの0始まりゼロ埋め表示（既存分類・新規追加した境界値分類の両方で確認する）
    const categoryRows: Record<string, unknown>[] = [];
    categorySheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 2) return; // 1行目タイトル、2行目見出し
      const values = row.values as unknown[];
      categoryRows.push({
        code: values[1],
        name: values[2],
        masterCount: values[3],
        createdBy: values[5],
        updatedBy: values[7],
      });
    });
    const boundaryCategoryCode = String(boundaryCategoryId).padStart(4, "0");
    const boundaryCategoryRow = categoryRows.find((r) => r.code === boundaryCategoryCode);
    expect(boundaryCategoryRow, "境界値分類の行がExcelに含まれること").toBeTruthy();
    expect(boundaryCategoryRow?.name).toBe(CATEGORY_NAME_30);
    expect(String(boundaryCategoryRow?.name).length).toBe(30);

    // 既存分類（登録者・最終更新者がnull）の行は空欄になっていること
    const existingNullCategoryRow = categoryRows.find(
      (r) => r.code !== boundaryCategoryCode && (r.createdBy == null || r.createdBy === ""),
    );
    expect(
      existingNullCategoryRow,
      "登録者がnullの既存分類が1件以上あること（前提データ）",
    ).toBeTruthy();
    expect(
      existingNullCategoryRow?.createdBy == null || existingNullCategoryRow?.createdBy === "",
    ).toBe(true);

    // マスタコード8文字・マスタ内容30文字ちょうどの境界値データの行を確認する
    const masterRows: Record<string, unknown>[] = [];
    masterSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber <= 2) return;
      const values = row.values as unknown[];
      masterRows.push({
        categoryCode: values[1],
        code: values[4],
        content: values[5],
        createdBy: values[7],
      });
    });
    const boundaryMasterRow = masterRows.find((r) => r.code === MASTER_CODE_8);
    expect(boundaryMasterRow, "境界値マスタの行がExcelに含まれること").toBeTruthy();
    expect(String(boundaryMasterRow?.code).length).toBe(8);
    expect(boundaryMasterRow?.content).toBe(MASTER_CONTENT_30);
    expect(String(boundaryMasterRow?.content).length).toBe(30);

    const existingNullMasterRow = masterRows.find(
      (r) => r.code !== MASTER_CODE_8 && (r.createdBy == null || r.createdBy === ""),
    );
    expect(
      existingNullMasterRow,
      "登録者がnullの既存マスタが1件以上あること（前提データ）",
    ).toBeTruthy();

    const record = await prisma.masterExcelExport.findUnique({ where: { id: exportId } });
    expect(categoryRows.length).toBe(record?.categoryRowCount);
    expect(masterRows.length).toBe(record?.masterRowCount);

    fs.writeFileSync(
      evidence("005_シート内容サマリ.json"),
      JSON.stringify(
        {
          categorySheetHeader: categoryHeaderRow.slice(1),
          masterSheetHeader: masterHeaderRow.slice(1),
          categoryRowCount: categoryRows.length,
          masterRowCount: masterRows.length,
          boundaryCategoryRow,
          boundaryMasterRow,
        },
        null,
        2,
      ),
    );
  });

  test("TC-006 VIEWERロールでの実行・他者履歴の閲覧・ダウンロード", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await login(page, VIEWER);
    await page.goto("/master/exports");

    // ADMINが作った完了済みの履歴が見える（ダウンロードリンクのhrefで対象行を特定する。
    // 実行者列は表示名（例: 初期管理者）でログインIDそのものは表示されないため）
    const adminDownloadLink = page.locator(`a[href="/api/master/exports/${exportId}/download"]`);
    await expect(adminDownloadLink).toBeVisible();
    const adminRow = adminDownloadLink.locator("xpath=ancestor::tr");
    await expect(adminRow).toContainText("完了");

    // VIEWERでも依頼できる（拒否されない）
    await page.getByRole("button", { name: "Excelを作成する" }).click();
    const queuedRow = page.locator("tbody tr").filter({ hasText: "受付済み" }).first();
    await expect(queuedRow).toBeVisible();

    // ADMINが作った履歴をVIEWERがダウンロードできる
    const downloadLink = page.locator(`a[href="/api/master/exports/${exportId}/download"]`);
    const downloadPromise = page.waitForEvent("download");
    await downloadLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^master_info_\d{14}\.xlsx$/);

    await page.screenshot({
      path: evidence("006_VIEWERロールでの実行と他者履歴ダウンロード.png"),
      fullPage: true,
    });

    const viewerExport = await prisma.masterExcelExport.findFirst({
      where: { requestedBy: VIEWER.id },
      orderBy: { createdAt: "desc" },
    });
    expect(viewerExport?.status).toBe("QUEUED");

    await context.close();
  });

  test("TC-007 マスタ管理画面からの導線ボタン", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/master");

    const excelButton = page.getByRole("link", { name: "マスタ管理情報Excel作成" });
    const categoryButton = page.getByRole("link", { name: "マスタ分類の管理" });
    await expect(excelButton).toBeVisible();
    await expect(categoryButton).toBeVisible();

    // DOM順で「マスタ管理情報Excel作成」が「マスタ分類の管理」より先に現れる
    const excelBox = await excelButton.boundingBox();
    const categoryBox = await categoryButton.boundingBox();
    expect(excelBox!.x).toBeLessThan(categoryBox!.x);

    await page.screenshot({ path: evidence("007_マスタ管理画面の導線ボタン.png"), fullPage: true });

    await excelButton.click();
    await expect(page).toHaveURL("http://localhost:3000/master/exports");
  });

  test("TC-008 未ログインで画面へ直接アクセス", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto("/master/exports");
    await expect(page).toHaveURL(/\/login/);
    await page.screenshot({ path: evidence("008_未ログイン画面アクセス.png"), fullPage: true });

    await context.close();
  });

  test("TC-009 未ログインでダウンロードURLへ直接アクセス", async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    const response = await page.goto(`/api/master/exports/${exportId}/download`);
    expect(response?.status()).toBe(401);
    const body = await response?.json();
    expect(body?.error?.code).toBe("UNAUTHORIZED");
    await page.screenshot({
      path: evidence("009_未ログインダウンロードアクセス.png"),
      fullPage: true,
    });

    await context.close();
  });

  test("TC-010 存在しない実行履歴IDへのアクセス", async ({ page }) => {
    await login(page, ADMIN);

    const response = await page.goto("/api/master/exports/not-exist-id-xxxxx/download");
    expect(response?.status()).toBe(404);
    const body = await response?.json();
    expect(body?.error?.code).toBe("MASTER_EXCEL_EXPORT_NOT_FOUND");
    await page.screenshot({ path: evidence("010_存在しない履歴IDアクセス.png"), fullPage: true });
  });
});
