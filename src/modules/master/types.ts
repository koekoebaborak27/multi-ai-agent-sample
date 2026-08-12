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

// 生成済みのCSV（MasterExport）を保持する時間。これを過ぎた行は、次回の依頼時にまとめて掃除する。
// 受け取り時に削除されなかった取り残し（生成失敗・ダウンロードされなかった等）を回収するための値であり、
// 案件ごとに変える値ではないため定数として持つ。
export const MASTER_EXPORT_RETENTION_HOURS = 24;

// pg-boss へCSV生成を依頼するキューの名前。
export const MASTER_EXPORT_QUEUE = "master.export";

/** CSV生成の依頼結果。受け取り・状態確認の画面がこのIDを使って問い合わせる */
export interface MasterExportRequest {
  exportId: string;
}

/** CSV生成の進み具合。画面はこれを2秒間隔で問い合わせ、READYになったら受け取りへ進む（§13.5.3） */
export interface MasterExportStatus {
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED";
  errorCode?: string;
}
