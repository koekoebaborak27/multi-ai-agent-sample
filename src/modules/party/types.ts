export const PARTY_SORT_FIELDS = ["name", "kind", "contactInfo"] as const;
export type PartySortField = (typeof PARTY_SORT_FIELDS)[number];

/** 一覧/表示用の契約先要約 */
export interface PartySummary {
  id: string;
  name: string;
  kind: string | null;
  contactInfo: string | null;
}
