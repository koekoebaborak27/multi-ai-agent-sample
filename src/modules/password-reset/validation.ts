import { z } from "zod";

/** 再発行申請フォーム（PWR-01）の入力チェック。形式の誤りだけを画面に出す */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, "メールアドレスを入力してください")
    .email("メールアドレスの形式が正しくありません")
    .max(254, "メールアドレスが長すぎます"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
