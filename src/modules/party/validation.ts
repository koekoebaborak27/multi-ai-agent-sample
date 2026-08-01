import { z } from "zod";

export const createPartySchema = z.object({
  name: z.string().min(1, "名称は必須です").max(200),
  kind: z.string().max(50).optional(),
  contactInfo: z.string().max(500).optional(),
});
export type CreatePartyInput = z.infer<typeof createPartySchema>;

export const updatePartySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "名称は必須です").max(200),
  kind: z.string().max(50).optional(),
  contactInfo: z.string().max(500).optional(),
});
export type UpdatePartyInput = z.infer<typeof updatePartySchema>;
