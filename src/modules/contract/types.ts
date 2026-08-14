// 契約一覧で並び替えできる項目の一覧。
// この並びを、URLパラメータのチェックとテーブル見出しのリンクの両方で参照している。
export const CONTRACT_SORT_FIELDS = [
  "title",
  "partyName",
  "startDate",
  "endDate",
  "status",
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

/** 契約一覧に表示する1行分の情報。開始日・終了日は未定のこともあるため空を許す */
export interface ContractSummary {
  id: string;
  partyId: string;
  partyName: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
}
