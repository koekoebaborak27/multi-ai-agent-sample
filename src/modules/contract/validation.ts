import { z } from "zod";

// 契約の状態。下書き・有効・終了の3つから選ぶ
const statusEnum = z.enum(["DRAFT", "ACTIVE", "TERMINATED"]);

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
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum.default("DRAFT"),
  categoryMasterId: categoryMasterIdSchema,
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

/** 契約の更新フォームの入力チェック。契約先は登録時に決めたものから変更できない */
export const updateContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum,
  categoryMasterId: categoryMasterIdSchema,
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
