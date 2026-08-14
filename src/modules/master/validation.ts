import { z } from "zod";
import { MASTER_SORT_FIELDS } from "@/modules/master/types";

// マスタ一覧画面のURLパラメータ（すべて文字列で渡ってくる）を、画面で使いやすい形に変換するチェックの定義。
// URLは利用者が手で書き換えたり、古いお気に入りから開いたりすることがあるため、
// おかしな値が来てもエラーにはせず、決まった初期値を使って画面を表示できるようにしている。
export const masterSearchQuerySchema = z.object({
  // 分類の指定を数値に変換する。
  // 「all」は「分類を指定しない」ことを表す特別な値としてそのまま残す。
  // 数値でも「all」でもない値、または値がないときは「未指定」として扱う。
  categoryId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      if (value === "all") return value;
      const categoryId = Number(value);
      return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined;
    }),
  // 前後の空白だけのキーワードは「入力なし」として扱う
  keyword: z
    .string()
    .optional()
    .transform((value) => value?.trim() || undefined),
  // ページ番号を数値に変換する。0以下・数字でない等のおかしな値は1ページ目にする
  page: z
    .string()
    .optional()
    .transform((value) => {
      const page = Number(value ?? 1);
      return Number.isInteger(page) && page > 0 ? page : 1;
    }),
  // 並び順の指定がおかしな値のときは、決まった並び順（分類名順・昇順）にする
  sort: z.enum(MASTER_SORT_FIELDS).catch("category").default("category"),
  order: z.enum(["asc", "desc"]).catch("asc").default("asc"),
});

export type MasterSearchQuery = z.infer<typeof masterSearchQuerySchema>;

// CSVダウンロード（MST-01からの依頼）の入力チェック。
// 一覧のURLパラメータと同じ変換を使うことで、一覧に表示している検索条件とダウンロード対象がずれないようにする。
// ページ番号・並び順はダウンロードでは使わないため受け取らない。
export const requestMasterExportSchema = z.object({
  categoryId: masterSearchQuerySchema.shape.categoryId,
  keyword: masterSearchQuerySchema.shape.keyword,
});

export type RequestMasterExportInput = z.infer<typeof requestMasterExportSchema>;

// マスタ一覧画面のURL。戻り先として認めるかどうかの判定基準に使う
const MASTER_LIST_PATH = "/master";

/**
 * 「一覧に戻るためのURL」として渡された値を確認し、問題があれば一覧画面のURLに置き換える。
 * 検索条件を保つためにURLを画面間で持ち回るが、その値を書き換えられても
 * 外部のサイトや別の画面へ移動させられないよう、マスタ一覧のURLだけを通す。
 */
export function parseMasterReturnTo(value: string | null | undefined): string {
  if (!value) return MASTER_LIST_PATH;
  return value === MASTER_LIST_PATH || value.startsWith(`${MASTER_LIST_PATH}?`)
    ? value
    : MASTER_LIST_PATH;
}

// 文字数を数える。
// 絵文字や一部の漢字は内部的に2文字分として扱われ、length では見た目より多く数えられてしまう。
// 利用者の感覚どおりの文字数で判定するため、1文字ずつに分解してから数える。
function countUnicodeCodePoints(value: string): number {
  return Array.from(value).length;
}

// マスタ分類名の入力チェック。新規作成と更新の両方で使う
const masterCategoryNameSchema = z
  .string()
  .trim()
  .min(1, "マスタ分類名は必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 30, {
    message: "マスタ分類名は30文字以内です",
  });

/** マスタ分類の新規登録フォームの入力チェック */
export const createMasterCategorySchema = z.object({
  name: masterCategoryNameSchema,
});

/**
 * マスタ分類の更新フォームの入力チェック。
 * updatedAt は更新画面を開いた時点の最終更新日時で、
 * 保存時に他の利用者が先に更新していないかを確かめるために画面から一緒に送られてくる。
 */
export const updateMasterCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive("マスタ分類IDが不正です"),
  name: masterCategoryNameSchema,
  updatedAt: z.coerce.date(),
});

export type CreateMasterCategoryInput = z.infer<typeof createMasterCategorySchema>;
export type UpdateMasterCategoryInput = z.infer<typeof updateMasterCategorySchema>;

// 分類プルダウンの選択内容のチェック。
// 未選択のときは空の文字列が送られてくるため、いきなり数値として受け取らず、
// 文字列で受けてから数値に変換し、変換できなければ「選択してください」と案内する。
const masterCategoryIdSchema = z
  .string()
  .transform((value) => Number(value.trim()))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "マスタ分類を選択してください",
  });

// マスタコードの入力チェック。
// 検索や並び替えで表記ゆれが起きないよう、使える文字を英大文字・数字・ハイフン・アンダースコアに限定する。
const masterCodeSchema = z
  .string()
  .trim()
  .min(1, "マスタコードは必須です")
  .max(8, "マスタコードは8文字以内です")
  .regex(
    /^[A-Z0-9_-]+$/,
    "マスタコードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
  );

// マスタ内容の入力チェック
const masterContentSchema = z
  .string()
  .trim()
  .min(1, "マスタ内容は必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 30, {
    message: "マスタ内容は30文字以内です",
  });

/** マスタの新規登録フォームの入力チェック */
export const createMasterSchema = z.object({
  categoryId: masterCategoryIdSchema,
  code: masterCodeSchema,
  content: masterContentSchema,
});

export type CreateMasterInput = z.infer<typeof createMasterSchema>;

/**
 * マスタの更新フォームの入力チェック。
 * updatedAt は更新画面を開いた時点の最終更新日時で、
 * 保存時に他の利用者が先に更新していないかを確かめるために画面から一緒に送られてくる。
 */
export const updateMasterSchema = z.object({
  masterId: z.coerce.number().int().positive("マスタIDが不正です"),
  categoryId: masterCategoryIdSchema,
  code: masterCodeSchema,
  content: masterContentSchema,
  updatedAt: z.coerce.date(),
});

export type UpdateMasterInput = z.infer<typeof updateMasterSchema>;

/**
 * マスタの削除の入力チェック。
 * updatedAt は詳細画面を開いた時点の最終更新日時で、削除実行時に他の利用者が先に
 * 更新・削除していないかを確かめるために画面から一緒に送られてくる。
 */
export const deleteMasterSchema = z.object({
  masterId: z.coerce.number().int().positive("マスタIDが不正です"),
  updatedAt: z.coerce.date(),
});

export type DeleteMasterInput = z.infer<typeof deleteMasterSchema>;

/**
 * マスタ分類の削除の入力チェック。
 * updatedAt は詳細画面を開いた時点の最終更新日時で、削除実行時に他の利用者が先に
 * 更新・削除していないかを確かめるために画面から一緒に送られてくる。
 */
export const deleteMasterCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive("マスタ分類IDが不正です"),
  updatedAt: z.coerce.date(),
});

export type DeleteMasterCategoryInput = z.infer<typeof deleteMasterCategorySchema>;
