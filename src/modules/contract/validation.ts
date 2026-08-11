import { z } from "zod";

// 契約の状態。下書き・有効・終了の3つから選ぶ
const statusEnum = z.enum(["DRAFT", "ACTIVE", "TERMINATED"]);

/** 契約の新規登録フォームの入力チェック。開始日・終了日は後から決めることもあるため任意 */
export const createContractSchema = z.object({
  partyId: z.string().min(1, "契約先は必須です"),
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum.default("DRAFT"),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

/** 契約の更新フォームの入力チェック。契約先は登録時に決めたものから変更できない */
export const updateContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum,
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
