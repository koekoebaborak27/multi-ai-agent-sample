import { z } from "zod";

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
  name: z.string().min(1, "名称は必須です").max(200),
  companyTypeMasterId: companyTypeMasterIdSchema,
  contactInfo: z.string().max(500).optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

/** 契約先の更新フォームの入力チェック。新規登録の項目に、対象を示す識別子を加えたもの */
export const updatePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "名称は必須です").max(200),
  companyTypeMasterId: companyTypeMasterIdSchema,
  contactInfo: z.string().max(500).optional(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
