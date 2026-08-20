import { z } from "zod";
import { PARTY_SORT_FIELDS } from "@/modules/party/types";

// 分類プルダウンの選択内容のチェック。
// 未選択のときは空の文字列が送られてくるため、いきなり数値として受け取らず、
// 文字列で受けてから数値に変換する。未選択・不正な値は「未設定」として扱うため
// エラーにはせず undefined へ倒す（マスタ分類IDの必須選択とは異なり、契約先の分類は任意入力のため）。
const companyTypeMasterIdSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });

/** 契約先の新規登録フォームの入力チェック。名称のみ必須で、分類・連絡先は任意 */
export const createPartySchema = z.object({
  name: z.string().min(1, "名称は必須です").max(200, "名称は200文字以内です"),
  companyTypeMasterId: companyTypeMasterIdSchema,
  contactInfo: z.string().max(500, "連絡先は500文字以内です").optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

/**
 * 契約先の更新フォームの入力チェック。新規登録の項目に、対象を示す識別子を加えたもの。
 * updatedAtは更新画面を開いた時点の最終更新日時で、保存時に他の利用者が先に更新していないかを
 * 確かめるために画面から一緒に送られてくる（§13.2）。
 */
export const updatePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "名称は必須です").max(200, "名称は200文字以内です"),
  companyTypeMasterId: companyTypeMasterIdSchema,
  contactInfo: z.string().max(500, "連絡先は500文字以内です").optional(),
  updatedAt: z.coerce.date(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;

// 契約先検索一覧画面（PTY-01）のURLパラメータを、画面で使いやすい形に変換するチェックの定義。
// URLは利用者が手で書き換えたり、古いお気に入りから開いたりすることがあるため、
// おかしな値が来てもエラーにはせず、決まった初期値（分類「すべて」・1ページ目・名称昇順）で
// 画面を表示できるようにしている。
export const partySearchQuerySchema = z.object({
  // 契約先分類は必須項目ではないため、マスタ一覧の分類プルダウンと違い「未指定」の初期値をそのまま
  // 「すべて」として扱う（先頭の分類を選ぶ、というフォールバックは行わない。§10.1.2）。
  companyTypeId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value === "all") return "all" as const;
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : ("all" as const);
    }),
  keyword: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  page: z
    .string()
    .optional()
    .transform((value) => {
      const page = Number(value ?? 1);
      return Number.isInteger(page) && page > 0 ? page : 1;
    }),
  sort: z.enum(PARTY_SORT_FIELDS).catch("name").default("name"),
  order: z.enum(["asc", "desc"]).catch("asc").default("asc"),
});

export type PartySearchQuery = z.infer<typeof partySearchQuerySchema>;

// 契約先検索一覧画面のURL。戻り先として認めるかどうかの判定基準に使う
const PARTY_LIST_PATH = "/parties";

/**
 * 「一覧に戻るためのURL」として渡された値を確認し、問題があれば一覧画面のURLに置き換える。
 * 検索条件を保つためにURLを画面間で持ち回るが、その値を書き換えられても
 * 外部のサイトや別の画面へ移動させられないよう、契約先一覧のURLだけを通す（マスタ機能と同じ考え方）。
 */
export function parsePartyReturnTo(value: string | null | undefined): string {
  if (!value) return PARTY_LIST_PATH;
  return value === PARTY_LIST_PATH || value.startsWith(`${PARTY_LIST_PATH}?`)
    ? value
    : PARTY_LIST_PATH;
}

/**
 * 削除完了を知らせる印（deleted=1）を、一覧に戻るURLへ付け加える。
 * 検索条件には含めないため、一覧画面側はこの印だけを見てトーストを表示し、条件には引き継がない。
 */
export function appendPartyDeletedFlag(returnTo: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}deleted=1`;
}

// 契約先削除の入力チェック。updatedAtは詳細画面を開いた時点の最終更新日時で、削除実行時に
// 他の利用者が先に更新・削除していないかを確かめるために画面から一緒に送られてくる。
export const deletePartySchema = z.object({
  id: z.string().min(1),
  updatedAt: z.coerce.date(),
});
export type DeletePartyInput = z.infer<typeof deletePartySchema>;
