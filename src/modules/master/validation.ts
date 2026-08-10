import { z } from "zod";
import { MASTER_SORT_FIELDS } from "@/modules/master/types";

export const masterSearchQuerySchema = z.object({
  categoryId: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return undefined;
      if (value === "all") return value;
      const categoryId = Number(value);
      return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined;
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
  sort: z.enum(MASTER_SORT_FIELDS).catch("category").default("category"),
  order: z.enum(["asc", "desc"]).catch("asc").default("asc"),
});

export type MasterSearchQuery = z.infer<typeof masterSearchQuerySchema>;

const MASTER_LIST_PATH = "/master";

/**
 * 遷移元のマスタ検索一覧URLを検証する。
 * 検索条件を復元するためにURLを持ち回るが、外部URLや別画面へは戻さない。
 */
export function parseMasterReturnTo(value: string | null | undefined): string {
  if (!value) return MASTER_LIST_PATH;
  return value === MASTER_LIST_PATH || value.startsWith(`${MASTER_LIST_PATH}?`)
    ? value
    : MASTER_LIST_PATH;
}

function countUnicodeCodePoints(value: string): number {
  return Array.from(value).length;
}

const masterCategoryNameSchema = z
  .string()
  .trim()
  .min(1, "マスタ分類名は必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 30, {
    message: "マスタ分類名は30文字以内です",
  });

export const createMasterCategorySchema = z.object({
  name: masterCategoryNameSchema,
});

export const updateMasterCategorySchema = z.object({
  categoryId: z.coerce.number().int().positive("マスタ分類IDが不正です"),
  name: masterCategoryNameSchema,
  updatedAt: z.coerce.date(),
});

export type CreateMasterCategoryInput = z.infer<typeof createMasterCategorySchema>;
export type UpdateMasterCategoryInput = z.infer<typeof updateMasterCategorySchema>;

/** プルダウンは未選択の場合に空文字を送るため、数値変換の前段で文字列として受ける */
const masterCategoryIdSchema = z
  .string()
  .transform((value) => Number(value.trim()))
  .refine((value) => Number.isInteger(value) && value > 0, {
    message: "マスタ分類を選択してください",
  });

const masterCodeSchema = z
  .string()
  .trim()
  .min(1, "マスタコードは必須です")
  .max(8, "マスタコードは8文字以内です")
  .regex(
    /^[A-Z0-9_-]+$/,
    "マスタコードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
  );

const masterContentSchema = z
  .string()
  .trim()
  .min(1, "マスタ内容は必須です")
  .refine((value) => countUnicodeCodePoints(value) <= 30, {
    message: "マスタ内容は30文字以内です",
  });

export const createMasterSchema = z.object({
  categoryId: masterCategoryIdSchema,
  code: masterCodeSchema,
  content: masterContentSchema,
});

export type CreateMasterInput = z.infer<typeof createMasterSchema>;
