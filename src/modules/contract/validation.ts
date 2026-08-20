import { z } from "zod";
import { CONTRACT_SORT_FIELDS, CONTRACT_STATUSES } from "@/modules/contract/types";

// 契約の状態。下書き・有効・終了の3つから選ぶ
const statusEnum = z.enum(CONTRACT_STATUSES);

// 契約分類プルダウンの選択内容のチェック。
// 未選択のときは空の文字列が送られてくるため、いきなり数値として受け取らず、
// 文字列で受けてから数値に変換する。未選択・不正な値は「未設定」として扱うためエラーにはせず
// undefined へ倒す（契約先のような必須選択ではなく、契約分類は任意入力のため）。
const categoryMasterIdSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : undefined;
  });

/** 契約の新規登録フォームの入力チェック。開始日・終了日・契約分類は後から決めることもあるため任意 */
export const createContractSchema = z.object({
  partyId: z.string().min(1, "契約先は必須です"),
  title: z.string().min(1, "契約名は必須です").max(200, "契約名は200文字以内です"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum.default("DRAFT"),
  categoryMasterId: categoryMasterIdSchema,
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

/**
 * 契約の更新フォームの入力チェック。契約先は登録時に決めたものから変更できない。
 * updatedAtは更新画面を開いた時点の最終更新日時で、保存時に他の利用者が先に更新していないかを
 * 確かめるために画面から一緒に送られてくる（§23.2）。
 */
export const updateContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "契約名は必須です").max(200, "契約名は200文字以内です"),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum,
  categoryMasterId: categoryMasterIdSchema,
  updatedAt: z.coerce.date(),
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;

// 契約検索一覧画面（CTR-01）のURLパラメータを、画面で使いやすい形に変換するチェックの定義。
// URLは利用者が手で書き換えたり、古いお気に入りから開いたりすることがあるため、
// おかしな値が来てもエラーにはせず、決まった初期値（すべて「すべて」・1ページ目・契約名昇順）で
// 画面を表示できるようにしている。
export const contractSearchQuerySchema = z.object({
  // 契約先・状態・契約分類はいずれも任意の絞り込み条件のため、初期値はすべて「すべて」とする（§20.1.2）
  partyId: z
    .string()
    .optional()
    .transform((value) => (!value || value === "all" ? ("all" as const) : value)),
  status: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value === "all") return "all" as const;
      const parsed = statusEnum.safeParse(value);
      return parsed.success ? parsed.data : ("all" as const);
    }),
  categoryId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value === "all") return "all" as const;
      const id = Number(value);
      return Number.isInteger(id) && id > 0 ? id : ("all" as const);
    }),
  page: z
    .string()
    .optional()
    .transform((value) => {
      const page = Number(value ?? 1);
      return Number.isInteger(page) && page > 0 ? page : 1;
    }),
  sort: z.enum(CONTRACT_SORT_FIELDS).catch("title").default("title"),
  order: z.enum(["asc", "desc"]).catch("asc").default("asc"),
});

export type ContractSearchQuery = z.infer<typeof contractSearchQuerySchema>;

// 契約検索一覧画面のURL。戻り先として認めるかどうかの判定基準に使う
const CONTRACT_LIST_PATH = "/contracts";

/**
 * 「一覧に戻るためのURL」として渡された値を確認し、問題があれば一覧画面のURLに置き換える。
 * 検索条件を保つためにURLを画面間で持ち回るが、その値を書き換えられても
 * 外部のサイトや別の画面へ移動させられないよう、契約一覧のURLだけを通す（マスタ機能と同じ考え方）。
 */
export function parseContractReturnTo(value: string | null | undefined): string {
  if (!value) return CONTRACT_LIST_PATH;
  return value === CONTRACT_LIST_PATH || value.startsWith(`${CONTRACT_LIST_PATH}?`)
    ? value
    : CONTRACT_LIST_PATH;
}

/**
 * 削除完了を知らせる印（deleted=1）を、一覧に戻るURLへ付け加える。
 * 検索条件には含めないため、一覧画面側はこの印だけを見てトーストを表示し、条件には引き継がない。
 */
export function appendContractDeletedFlag(returnTo: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}deleted=1`;
}

// 契約削除の入力チェック。updatedAtは詳細画面を開いた時点の最終更新日時で、削除実行時に
// 他の利用者が先に更新・削除していないかを確かめるために画面から一緒に送られてくる。
export const deleteContractSchema = z.object({
  id: z.string().min(1),
  updatedAt: z.coerce.date(),
});
export type DeleteContractInput = z.infer<typeof deleteContractSchema>;
