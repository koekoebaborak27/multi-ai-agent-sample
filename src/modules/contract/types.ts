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
