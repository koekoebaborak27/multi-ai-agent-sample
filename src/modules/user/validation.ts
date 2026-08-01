import { z } from "zod";
import { ALL_ROLES } from "@/shared/constants/roles";

const roleEnum = z.enum(ALL_ROLES as [string, ...string[]]);

export const createUserSchema = z.object({
  userId: z.string().min(1, "ユーザーIDは必須です").max(64, "ユーザーIDは64文字以内です"),
  displayName: z.string().max(128).optional(),
  email: z.union([z.string().email("メール形式が不正です"), z.literal("")]).optional(),
  role: roleEnum,
  password: z
    .union([z.string().min(8, "パスワードは8文字以上にしてください").max(128), z.literal("")])
    .optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  userId: z.string().min(1).max(64),
  displayName: z.string().max(128).optional(),
  role: roleEnum,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
