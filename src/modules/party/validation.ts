import { z } from "zod";

/** 契約先の新規登録フォームの入力チェック。名称のみ必須で、種別・連絡先は任意 */
export const createPartySchema = z.object({
  name: z.string().min(1, "名称は必須です").max(200),
  kind: z.string().max(50).optional(),
  contactInfo: z.string().max(500).optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

/** 契約先の更新フォームの入力チェック。新規登録の項目に、対象を示す識別子を加えたもの */
export const updatePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "名称は必須です").max(200),
  kind: z.string().max(50).optional(),
  contactInfo: z.string().max(500).optional(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
