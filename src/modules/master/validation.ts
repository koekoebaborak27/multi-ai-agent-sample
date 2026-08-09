import { z } from "zod";

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
