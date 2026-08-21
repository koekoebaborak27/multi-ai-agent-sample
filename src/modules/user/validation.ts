import { z } from "zod";
import { ALL_ROLES } from "@/shared/constants/roles";

// 選べる役割。定義の正本は shared/constants/roles.ts 側に置き、ここではそれを参照するだけにする
const roleEnum = z.enum(ALL_ROLES as [string, ...string[]]);

/**
 * 利用者の新規登録フォームの入力チェック。
 * 初期パスワードは任意。入力しない場合、その利用者は Microsoft アカウントでのみログインできる。
 */
export const createUserSchema = z.object({
  userId: z.string().min(1, "ユーザーIDは必須です").max(64, "ユーザーIDは64文字以内です"),
  displayName: z.string().max(128).optional(),
  email: z.string().min(1, "メールアドレスは必須です").email("メール形式が不正です"),
  role: roleEnum,
  password: z
    .union([z.string().min(8, "パスワードは8文字以上にしてください").max(128), z.literal("")])
    .optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * 利用者の更新フォームの入力チェック。変更できるのは表示名・メールアドレス・役割。
 * メールアドレスが未登録の利用者もいるため、更新画面でも空のままにしておける。
 */
export const updateUserSchema = z.object({
  userId: z.string().min(1).max(64),
  displayName: z.string().max(128).optional(),
  email: z.union([z.string().email("メール形式が不正です"), z.literal("")]).optional(),
  role: roleEnum,
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
