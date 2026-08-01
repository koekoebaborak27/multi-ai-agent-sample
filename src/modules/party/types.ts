/** 一覧/表示用の契約先要約 */
export interface PartySummary {
  id: string;
  name: string;
  kind: string | null;
  contactInfo: string | null;
}
