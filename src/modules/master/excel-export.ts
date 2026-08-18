import ExcelJS from "exceljs";
import { formatCsvDateTime, formatFileNameTimestamp } from "@/modules/master/export";
import { formatMasterCategoryCode } from "@/modules/master/service";
import type { MasterCategoryDetail, MasterDetail } from "@/modules/master/types";

// マスタ情報Excel取得（設計書§40.2）の中身を組み立てる処理。
// データベースにもファイル置き場にも触れず、渡された行データから「.xlsx」の中身を作って返すだけにしている。
// こうしておくことで、この処理だけを単体テストできる。
// 呼び出すのは裏側で動くプログラム（worker。jobs.ts経由）だけであり、画面の配布物（バンドル）には
// 含めない。exceljsは容量が大きく、画面から読み込むとその分まで一緒に配られてしまうため。

/** タイトル行（1行目）の次に置く、列名の行の番号 */
const HEADER_ROW_NUMBER = 2;
/** データが始まる行の番号 */
const FIRST_DATA_ROW_NUMBER = HEADER_ROW_NUMBER + 1;

/** 見出し行の背景色（濃い青）。既存の画面デザインの基調色に合わせている */
const HEADER_FILL_ARGB = "FF1E3A8A";
/** 見出し行の文字色（白） */
const HEADER_FONT_ARGB = "FFFFFFFF";
/** データ行の縞模様に使う薄い青 */
const STRIPE_FILL_ARGB = "FFEFF6FF";
/** 日時セルの表示形式。日本時間で「年/月/日 時:分:秒」と読めるようにする */
const DATE_TIME_NUMBER_FORMAT = "yyyy/mm/dd hh:mm:ss";
/** 日本標準時と世界標準時の差（9時間をミリ秒にした値） */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

type CellValue = string | number | Date | null;

/**
 * 日時をExcelの日付として書き込める形に直す。
 * Excelのファイルは日時を「世界標準時からの経過日数」で持っており、`Date`をそのまま書き込むと
 * 世界標準時の時刻として表示されてしまう。日本時間で表示させるため、あらかじめ9時間進めた値を渡す。
 * 日本には夏時間が無いため、常に9時間で正しい（ローカル環境・本番のCloud Runのどちらで動かしても結果は変わらない）。
 */
function toExcelDateTime(date: Date): Date {
  return new Date(date.getTime() + JST_OFFSET_MS);
}

/** 1シート分の設計。列の並びと中身だけがシートごとに異なり、見た目の作り方は共通にする */
interface SheetPlan {
  /** シートの名前（タブに表示される） */
  sheetName: string;
  /** 1行目に出すタイトル */
  title: string;
  /** 列名と、見やすいおおよその幅 */
  columns: { header: string; width: number }[];
  /** データ行。1行が1つの配列で、列の並びに合わせておく */
  rows: CellValue[][];
}

// 1枚のシートを作る。タイトル行・見出し行・データ行の順に書き込み、見た目を整える。
function writeSheet(workbook: ExcelJS.Workbook, plan: SheetPlan, generatedAt: Date): void {
  // 見出し行より上でスクロールが止まるよう、シートを作る時点で固定位置を指定する
  const sheet = workbook.addWorksheet(plan.sheetName, {
    views: [{ state: "frozen", ySplit: HEADER_ROW_NUMBER }],
  });

  plan.columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = column.width;
  });

  // 1行目: 何のシートか・いつ出したか・何件あるかを一目で分かるようにする
  const titleRow = sheet.getRow(1);
  titleRow.getCell(1).value = plan.title;
  titleRow.getCell(1).font = { bold: true, size: 14 };
  titleRow.getCell(3).value = `出力日時: ${formatCsvDateTime(generatedAt)}`;
  titleRow.getCell(5).value = `件数: ${plan.rows.length}件`;

  // 2行目: 列名。太字・白文字・濃い背景色にして、データ行と見分けやすくする
  const headerRow = sheet.getRow(HEADER_ROW_NUMBER);
  headerRow.values = plan.columns.map((column) => column.header);
  headerRow.font = { bold: true, color: { argb: HEADER_FONT_ARGB } };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_FILL_ARGB } };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  // 3行目以降: データ本体。値が無い項目（null）には何も入れず、そのまま空欄にする
  plan.rows.forEach((values, rowIndex) => {
    const row = sheet.getRow(FIRST_DATA_ROW_NUMBER + rowIndex);
    // 1行おきに薄い色を敷き、行数が多いときに目線が隣の行へずれるのを防ぐ
    const isStripeRow = rowIndex % 2 === 1;
    values.forEach((value, columnIndex) => {
      const cell = row.getCell(columnIndex + 1);
      cell.value = value;
      if (value instanceof Date) cell.numFmt = DATE_TIME_NUMBER_FORMAT;
      if (isStripeRow) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: STRIPE_FILL_ARGB } };
      }
    });
  });

  // 見出し行から、列ごとの絞り込み・並べ替えができるようにする
  sheet.autoFilter = {
    from: { row: HEADER_ROW_NUMBER, column: 1 },
    to: { row: HEADER_ROW_NUMBER, column: plan.columns.length },
  };
}

function buildCategorySheetPlan(categories: MasterCategoryDetail[]): SheetPlan {
  return {
    sheetName: "マスタ分類",
    title: "マスタ分類一覧",
    columns: [
      { header: "マスタ分類コード", width: 16 },
      { header: "マスタ分類名", width: 24 },
      { header: "登録マスタ件数", width: 14 },
      { header: "登録日時", width: 20 },
      { header: "登録者", width: 14 },
      { header: "最終更新日時", width: 20 },
      { header: "最終更新者", width: 14 },
    ],
    rows: categories.map((category) => [
      formatMasterCategoryCode(category.id),
      category.name,
      category.masterCount,
      toExcelDateTime(category.createdAt),
      category.createdBy,
      toExcelDateTime(category.updatedAt),
      category.updatedBy,
    ]),
  };
}

function buildMasterSheetPlan(masters: MasterDetail[]): SheetPlan {
  return {
    sheetName: "マスタ",
    title: "マスタ一覧",
    columns: [
      { header: "マスタ分類コード", width: 16 },
      { header: "マスタ分類名", width: 20 },
      { header: "マスタID", width: 10 },
      { header: "マスタコード", width: 16 },
      { header: "マスタ内容", width: 30 },
      { header: "登録日時", width: 20 },
      { header: "登録者", width: 14 },
      { header: "最終更新日時", width: 20 },
      { header: "最終更新者", width: 14 },
    ],
    rows: masters.map((master) => [
      formatMasterCategoryCode(master.categoryId),
      master.categoryName,
      master.id,
      master.code,
      master.content,
      toExcelDateTime(master.createdAt),
      master.createdBy,
      toExcelDateTime(master.updatedAt),
      master.updatedBy,
    ]),
  };
}

/**
 * マスタ分類・マスタの2シートを持つExcelファイルを組み立てる。
 * シートの順番は「マスタ分類」「マスタ」で固定する（設計書§40.2.1）。
 */
export async function buildMasterInfoExcel(input: {
  categories: MasterCategoryDetail[];
  masters: MasterDetail[];
  generatedAt: Date;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  writeSheet(workbook, buildCategorySheetPlan(input.categories), input.generatedAt);
  writeSheet(workbook, buildMasterSheetPlan(input.masters), input.generatedAt);
  // exceljsが返すのはNode.jsの Buffer とは別の型（ArrayBuffer寄りの型）のため、
  // ファイル保存（storage.upload）でそのまま使えるよう Buffer に詰め替える。
  const data = await workbook.xlsx.writeBuffer();
  return Buffer.from(data);
}

/** ファイル置き場へ保存するときの名前を作る。例: master_info_20260817103000.xlsx */
export function buildMasterInfoExcelFileName(generatedAt: Date): string {
  return `master_info_${formatFileNameTimestamp(generatedAt)}.xlsx`;
}
