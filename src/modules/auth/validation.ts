import { z } from "zod";

/** ログイン画面の入力チェック */
export const credentialsLoginSchema = z.object({
  userId: z.string().min(1, "ユーザーIDを入力してください").max(64),
  password: z.string().min(1, "パスワードを入力してください"),
});
export type CredentialsLoginInput = z.infer<typeof credentialsLoginSchema>;

/**
 * パスワード変更画面の入力チェック。
 * 新しいパスワードには英字と数字の両方を含めることと、8文字以上であることを求める。
 * 加えて、確認用の入力と一致すること・現在のパスワードとは違うことも確かめる。
 */
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
