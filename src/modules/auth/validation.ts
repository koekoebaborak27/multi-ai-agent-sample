import { z } from "zod";

/** ID/PW ログインの入力 */
export const credentialsLoginSchema = z.object({
  userId: z.string().min(1, "ユーザーIDを入力してください").max(64),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type CredentialsLoginInput = z.infer<typeof credentialsLoginSchema>;

/** パスワード変更の入力 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "現在のパスワードを入力してください"),
    newPassword: z
      .string()
      .min(8, "新しいパスワードは8文字以上にしてください")
      .max(128)
      .regex(/[A-Za-z]/, "英字を含めてください")
      .regex(/[0-9]/, "数字を含めてください"),
    confirmPassword: z.string().min(1, "確認用パスワードを入力してください"),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "新しいパスワードが一致しません",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "現在のパスワードと異なるものにしてください",
  });
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
