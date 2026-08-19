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

// 契約の状態の一覧。UI部品の選択肢と入力チェック（validation.ts）の両方で参照している。
export const CONTRACT_STATUSES = ["DRAFT", "ACTIVE", "TERMINATED"] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

// 契約の状態を画面に表示する日本語ラベルへ変換するための対応表
export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
  DRAFT: "下書き",
  ACTIVE: "有効",
  TERMINATED: "終了",
};

/** 契約検索で使う絞り込み条件。指定しなければ全件が対象になる */
export interface ContractSearchCriteria {
  partyId?: string;
  status?: ContractStatus;
  categoryMasterId?: number;
}

/** 契約詳細・更新画面に表示する情報。登録者・更新者はUser.idをそのまま表示する（表示名の解決は行わない） */
export interface ContractDetail extends ContractSummary {
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}
