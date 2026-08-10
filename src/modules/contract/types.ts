export const CONTRACT_SORT_FIELDS = [
  "title",
  "partyName",
  "startDate",
  "endDate",
  "status",
] as const;
export type ContractSortField = (typeof CONTRACT_SORT_FIELDS)[number];

/** 一覧/表示用の契約要約 */
export interface ContractSummary {
  id: string;
  partyId: string;
  partyName: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  status: string;
}
