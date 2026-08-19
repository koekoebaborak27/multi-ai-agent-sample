// 契約先一覧で並び替えできる項目の一覧。
// この並びを、URLパラメータのチェックとテーブル見出しのリンクの両方で参照している。
// 分類はマスタの内容を解決した表示専用の値であり、データベース上でソートできないため対象に含めない。
export const PARTY_SORT_FIELDS = ["name", "contactInfo"] as const;
export type PartySortField = (typeof PARTY_SORT_FIELDS)[number];

// 契約先分類として扱うマスタ分類の分類コード。
// 契約先の登録・更新・一覧表示は、この分類コードでマスタ分類（マスタ分類の初期データ。
// prisma/seed.ts 参照）を探し、その配下のマスタから選ばせる。
export const PARTY_COMPANY_TYPE_CATEGORY_CODE = "CONTRACT_COMPANY_TYPE";

/**
 * 契約先一覧に表示する1行分の情報。連絡先は任意入力のため空を許す。
 * 分類はマスタのIDを保持し、表示用の内容（companyTypeLabel）はマスタから解決した値を持たせる。
 * 該当するマスタが無い（未選択・削除済み）場合は「未設定」とする。
 */
export interface PartySummary {
  id: string;
  name: string;
  companyTypeMasterId: number | null;
  companyTypeLabel: string;
  contactInfo: string | null;
}

/** 契約先検索で使う絞り込み条件。どちらも指定しなければ全件が対象になる */
export interface PartySearchCriteria {
  keyword?: string;
  companyTypeMasterId?: number;
}

/** 契約先詳細・更新画面に表示する情報。登録者・更新者はUser.idをそのまま表示する（表示名の解決は行わない） */
export interface PartyDetail extends PartySummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}
