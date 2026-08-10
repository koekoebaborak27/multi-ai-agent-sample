export const MASTER_SORT_FIELDS = ["category", "code", "content"] as const;
export type MasterSortField = (typeof MASTER_SORT_FIELDS)[number];

export const MASTER_CATEGORY_SORT_FIELDS = ["code", "name", "masterCount"] as const;
export type MasterCategorySortField = (typeof MASTER_CATEGORY_SORT_FIELDS)[number];

/** マスタ分類一覧に表示する1行分の情報 */
export interface MasterCategorySummary {
  id: number;
  code: string;
  name: string;
  masterCount: number;
}

/** 検索条件の選択肢に表示するマスタ分類 */
export type MasterCategoryOption = Pick<MasterCategorySummary, "id" | "code" | "name">;

/** マスタ検索一覧に表示する1行分の情報 */
export interface MasterSummary {
  id: number;
  categoryId: number;
  categoryName: string;
  code: string;
  content: string;
}

/** マスタ検索で使用する任意条件 */
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
