// 契約一覧で並び替えできる項目の一覧。
// この並びを、URLパラメータのチェックとテーブル見出しのリンクの両方で参照している。
// 契約分類はマスタの内容を解決した表示専用の値であり、データベース上でソートできないため対象に含めない。
export const CONTRACT_SORT_FIELDS = [
  "title",
  "partyName",
  "startDate",
  "endDate",
  "status",
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

// 契約分類として扱うマスタ分類の分類コード。
// 契約の登録・更新・一覧表示は、この分類コードでマスタ分類（マスタ分類の初期データ。
// prisma/seed.ts 参照）を探し、その配下のマスタから選ばせる。
export const CONTRACT_CATEGORY_MASTER_CATEGORY_CODE = "CONTRACT_TYPE";

/**
 * 契約一覧に表示する1行分の情報。開始日・終了日は未定のこともあるため空を許す。
 * 契約分類はマスタのIDを保持し、表示用の内容（categoryLabel）はマスタから解決した値を持たせる。
 * 該当するマスタが無い（未選択・削除済み）場合は「未設定」とする。
 */
export interface ContractSummary {
  id: string;
  partyId: string;
  partyName: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
  categoryMasterId: number | null;
  categoryLabel: string;
}
