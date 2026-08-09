/** マスタ分類一覧に表示する1行分の情報 */
export interface MasterCategorySummary {
  id: number;
  code: string;
  name: string;
  masterCount: number;
}

/** マスタ分類詳細・更新画面に表示する情報 */
export interface MasterCategoryDetail extends MasterCategorySummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}
