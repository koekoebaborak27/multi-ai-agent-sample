import { z } from "zod";
import { NEWS_CATEGORIES, NEWS_SORT_FIELDS } from "@/modules/news/types";

// 文字数をUnicodeコードポイント単位で数える。
// 絵文字や一部の漢字はlengthでは見た目より多く数えられてしまうため、1文字ずつに分解してから数える
// （マスタ機能のvalidation.tsと同じ理由・同じ実装）。
function countUnicodeCodePoints(value: string): number {
  return Array.from(value).length;
}

// お知らせ管理一覧（NEWS-02）のURLパラメータを、画面で使いやすい形に変換するチェックの定義。
// URLは利用者が手で書き換えたり、古いお気に入りから開いたりすることがあるため、
// おかしな値が来てもエラーにはせず、決まった初期値を使って画面を表示できるようにしている。
export const newsSearchQuerySchema = z.object({
  // カテゴリ未指定・「all」・存在しない値は、いずれも「絞り込みなし」として扱う
  category: z
    .string()
    .optional()
    .transform((value) => {
      if (!value || value === "all") return undefined;
      return (NEWS_CATEGORIES as readonly string[]).includes(value)
        ? (value as (typeof NEWS_CATEGORIES)[number])
        : undefined;
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
  // 並び順の指定がおかしな値のときは、初期の並び順（公開開始日時の新しい順。§20.1.3）にする
  sort: z.enum(NEWS_SORT_FIELDS).catch("startAt").default("startAt"),
  order: z.enum(["asc", "desc"]).catch("desc").default("desc"),
});

export type NewsSearchQuery = z.infer<typeof newsSearchQuerySchema>;

const newsTitleSchema = z
  .string()
  .trim()
  .min(1, "タイトルは必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 200, {
    message: "タイトルは200文字以内です",
  });

// 本文は改行以外の前後の空白除去を行わない（意図した字下げ・空白を壊さないため。§21.3）
const newsBodySchema = z
  .string()
  .min(1, "本文は必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 3000, {
    message: "本文は3000文字以内です",
  });

const newsCategorySchema = z.enum(NEWS_CATEGORIES);

// 公開終了日時が公開開始日時より前でないことを確認する（§21.3）。
// 両方空欄、または片方だけが指定されている場合はこの検証を行わない（同時刻は許可する）。
function refineNewsPeriod(
  data: { startAt?: Date; endAt?: Date },
  ctx: z.RefinementCtx,
): void {
  if (data.startAt && data.endAt && data.endAt.getTime() < data.startAt.getTime()) {
    ctx.addIssue({
      code: "custom",
      path: ["endAt"],
      message: "公開終了日時は公開開始日時以降にしてください",
    });
  }
}

/** お知らせの新規登録フォームの入力チェック（§21.1.2・§21.3） */
export const createNewsSchema = z
  .object({
    title: newsTitleSchema,
    category: newsCategorySchema,
    body: newsBodySchema,
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    // 未送信（HTMLのswitchが未チェックのとき）はOFFとして扱う
    published: z.boolean().default(true),
  })
  .superRefine(refineNewsPeriod);

export type CreateNewsInput = z.infer<typeof createNewsSchema>;

/**
 * お知らせの更新フォームの入力チェック（§22.1.2）。
 * updatedAtは更新ポップアップを開いた時点の最終更新日時で、保存時に他の利用者が
 * 先に更新していないかを確かめるために画面から一緒に送られてくる（§22.2）。
 */
export const updateNewsSchema = z
  .object({
    newsId: z.string().min(1, "お知らせIDが不正です"),
    title: newsTitleSchema,
    category: newsCategorySchema,
    body: newsBodySchema,
    startAt: z.coerce.date().optional(),
    endAt: z.coerce.date().optional(),
    published: z.boolean(),
    updatedAt: z.coerce.date(),
  })
  .superRefine(refineNewsPeriod);

export type UpdateNewsInput = z.infer<typeof updateNewsSchema>;

/**
 * お知らせの削除の入力チェック（§23.2）。
 * updatedAtは一覧を表示した時点の最終更新日時で、削除実行時に他の利用者が
 * 先に更新・削除していないかを確かめるために画面から一緒に送られてくる。
 */
export const deleteNewsSchema = z.object({
  newsId: z.string().min(1, "お知らせIDが不正です"),
  updatedAt: z.coerce.date(),
});

export type DeleteNewsInput = z.infer<typeof deleteNewsSchema>;
