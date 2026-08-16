// マスタ一覧で並び替えできる項目の一覧。
// この並びを、URLパラメータのチェック（validation.ts）とテーブル見出しのリンク（ui/master-table.tsx）の
// 両方で参照している。
export const MASTER_SORT_FIELDS = ["category", "code", "content"] as const;
export type MasterSortField = (typeof MASTER_SORT_FIELDS)[number];

// マスタ分類一覧で並び替えできる項目の一覧（マスタ一覧の分類版）
export const MASTER_CATEGORY_SORT_FIELDS = ["code", "name", "masterCount"] as const;
export type MasterCategorySortField = (typeof MASTER_CATEGORY_SORT_FIELDS)[number];

/** マスタ分類一覧に表示する1行分の情報 */
export interface MasterCategorySummary {
  id: number;
  code: string;
  name: string;
  masterCount: number;
}

/** 検索条件の分類プルダウンに表示する選択肢。一覧の1行分より必要な項目が少ないため、その一部だけを使う */
export type MasterCategoryOption = Pick<MasterCategorySummary, "id" | "code" | "name">;

/** マスタ一覧に表示する1行分の情報 */
export interface MasterSummary {
  id: number;
  categoryId: number;
  categoryName: string;
  code: string;
  content: string;
}

/** マスタ検索で使う絞り込み条件。分類・キーワードのどちらも指定しなければ全件が対象になる */
export interface MasterSearchCriteria {
  categoryId?: number;
  keyword?: string;
}

/** マスタ詳細・更新画面に表示する情報 */
export interface MasterDetail extends MasterSummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

/** マスタ分類詳細・更新画面に表示する情報 */
export interface MasterCategoryDetail extends MasterCategorySummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

// CSVダウンロードの対象。マスタ本体と分類とで出力する列が異なる（export.ts）
export const MASTER_EXPORT_TARGETS = ["MASTER", "MASTER_CATEGORY"] as const;
export type MasterExportTarget = (typeof MASTER_EXPORT_TARGETS)[number];

// 1回のCSVダウンロードで出力できる行数の上限。
// 案件ごとに変える値ではなく、増やす場合は生成方式（分割出力・ストリーミング）自体を見直すべき値のため、
// 環境変数にはせずこの定数として持つ。
export const MASTER_EXPORT_MAX_ROWS = 10000;

// マスタ情報Excel取得の依頼を積む順番待ちの列（キュー）の名前。
// 依頼側（service.ts）と、生成側（workerのキュー購読処理）の両方がこの名前を使うため、
// 文字列を2か所に書いてずれる事故を防ぐ目的で定数にしている。
export const MASTER_EXCEL_EXPORT_QUEUE = "master.excel-export";

// マスタ情報Excel取得1回あたりの出力上限（分類・マスタそれぞれの件数。設計書§40.8）。
// CSVダウンロードの MASTER_EXPORT_MAX_ROWS と値は同じだが、対象が別機能のため別の定数として持つ。
export const MASTER_EXCEL_EXPORT_MAX_ROWS = 10000;

// マスタ情報Excel取得の実行履歴の状態。データベース上は文字列で持つが、
// コード上はこの4値に限定することで、状態名の打ち間違いを防ぐ。
export const MASTER_EXCEL_EXPORT_STATUSES = ["QUEUED", "RUNNING", "READY", "FAILED"] as const;
export type MasterExcelExportStatus = (typeof MASTER_EXCEL_EXPORT_STATUSES)[number];

/** Excel取得の依頼を受け付けたときの戻り値。作成した実行履歴のIDだけを返す */
export interface MasterExcelExportRequest {
  exportId: string;
}

/** 順番待ちの列に積む依頼の中身。全件固定出力で検索条件を持たないため、履歴のIDだけで足りる */
export interface MasterExcelExportJobData {
  exportId: string;
}
