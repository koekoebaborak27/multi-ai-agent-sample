import Papa from "papaparse";
import type {
  MasterCategoryDetail,
  MasterDetail,
  MasterExportTarget,
} from "@/modules/master/types";

// CSVの日時列に使う書式。Intl.DateTimeFormat がそのまま出す文字列は環境によって区切り文字が
// 変わることがあるため、年月日時分秒をそれぞれ取り出して "YYYY/MM/DD HH:mm:ss" に自分で組み立てる。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

function dateTimeParts(date: Date): Record<string, string> {
  return Object.fromEntries(
    dateTimeFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
}

// 日時を「年/月/日 時:分:秒」の文字列にする。タイムゾーンは日本時間に固定する。
// CSVのセル値だけでなく、Excel版（excel-export.ts）のタイトル行に出す「出力日時」の文字列にも使う。
export function formatCsvDateTime(date: Date): string {
  const p = dateTimeParts(date);
  return `${p.year}/${p.month}/${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

// ダウンロードファイル名に使う日時文字列にする（区切り文字なしの14桁）。
// CSV版・Excel版（excel-export.ts）の両方でファイル名の日時部分を同じ形にするため、ここから共有する。
export function formatFileNameTimestamp(date: Date): string {
  const p = dateTimeParts(date);
  return `${p.year}${p.month}${p.day}${p.hour}${p.minute}${p.second}`;
}

// 値が無い（null）場合を空欄にする。画面では「—」と表示するが、CSVでは記号を出さない。
// 取り込み先のシステムが「値が入っていない」と判定できるようにするため。
function orBlank(value: string | null): string {
  return value ?? "";
}

const BOM = "\uFEFF";

// Microsoft ExcelがUTF-8と判定できるよう、CSVの先頭にBOMを付ける。
function withBom(csv: string): string {
  return BOM + csv;
}

const MASTER_EXPORT_FIELDS = [
  "マスタ分類コード",
  "マスタ分類名",
  "マスタID",
  "マスタコード",
  "マスタ内容",
  "登録日時",
  "登録者",
  "最終更新日時",
  "最終更新者",
] as const;

// マスタの一覧をCSV文字列に変換する（MST-01からのダウンロード用）。
// 行の並びは呼び出し元（検索条件・並び順に従って取得した結果）をそのまま使う。
export function buildMasterExportCsv(rows: MasterDetail[]): string {
  const data = rows.map((row) => [
    row.categoryCode,
    row.categoryName,
    row.id,
    row.code,
    row.content,
    formatCsvDateTime(row.createdAt),
    orBlank(row.createdBy),
    formatCsvDateTime(row.updatedAt),
    orBlank(row.updatedBy),
  ]);
  return withBom(Papa.unparse({ fields: [...MASTER_EXPORT_FIELDS], data }));
}

const MASTER_CATEGORY_EXPORT_FIELDS = [
  "マスタ分類コード",
  "マスタ分類名",
  "登録マスタ件数",
  "登録日時",
  "登録者",
  "最終更新日時",
  "最終更新者",
] as const;

// マスタ分類の一覧をCSV文字列に変換する（MST-06からのダウンロード用）。
export function buildMasterCategoryExportCsv(rows: MasterCategoryDetail[]): string {
  const data = rows.map((row) => [
    row.code,
    row.name,
    row.masterCount,
    formatCsvDateTime(row.createdAt),
    orBlank(row.createdBy),
    formatCsvDateTime(row.updatedAt),
    orBlank(row.updatedBy),
  ]);
  return withBom(Papa.unparse({ fields: [...MASTER_CATEGORY_EXPORT_FIELDS], data }));
}

// 利用者に見せるダウンロードファイル名を作る。起点画面によって名前を変える。
// ストレージ上の保存名（生成物の実体を指すパス）とは別物であり、そちらは依頼・生成側で管理する。
export function buildMasterExportFileName(target: MasterExportTarget, generatedAt: Date): string {
  const timestamp = formatFileNameTimestamp(generatedAt);
  return target === "MASTER" ? `master_${timestamp}.csv` : `master_categories_${timestamp}.csv`;
}
