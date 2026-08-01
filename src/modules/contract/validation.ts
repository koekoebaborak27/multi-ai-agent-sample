import { z } from "zod";

const statusEnum = z.enum(["DRAFT", "ACTIVE", "TERMINATED"]);

export const createContractSchema = z.object({
  partyId: z.string().min(1, "契約先は必須です"),
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum.default("DRAFT"),
});
export type CreateContractInput = z.infer<typeof createContractSchema>;

export const updateContractSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1, "契約名は必須です").max(200),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  status: statusEnum,
});
export type UpdateContractInput = z.infer<typeof updateContractSchema>;
