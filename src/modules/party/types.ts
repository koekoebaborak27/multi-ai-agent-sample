// 契約先一覧で並び替えできる項目の一覧。
// この並びを、URLパラメータのチェックとテーブル見出しのリンクの両方で参照している。
export const PARTY_SORT_FIELDS = ["name", "kind", "contactInfo"] as const;
export type PartySortField = (typeof PARTY_SORT_FIELDS)[number];

/** 契約先一覧に表示する1行分の情報。種別・連絡先は任意入力のため空を許す */
export interface PartySummary {
  id: string;
  name: string;
  kind: string | null;
  contactInfo: string | null;
}
