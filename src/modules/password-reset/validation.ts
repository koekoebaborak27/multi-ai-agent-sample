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

/**
 * パスワード再設定画面（PWR-02）の入力チェック。
 * 条件は既存のパスワード変更画面（passwordChangeSchema）と揃えるが、
 * 今のパスワードを覚えていない利用者が使う画面のため「今のパスワードと違うこと」は求めない。
 */
export const resetPasswordSchema = z
  .object({
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
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * メールアドレス変更申し込み画面（EML-01）の入力チェック。
 * 「今のアドレスと同じでないこと」を確かめるには今のアドレスが要るため、固定のスキーマにはできず、
 * 呼び出す側が今のアドレスを渡して作る関数にしている。
 */
export function requestEmailChangeSchema(currentEmail: string | null) {
  return z
    .object({
      newEmail: z
        .string()
        .min(1, "メールアドレスを入力してください")
        .email("メールアドレスの形式が正しくありません")
        .max(254, "メールアドレスが長すぎます"),
    })
    .refine((v) => v.newEmail.toLowerCase() !== (currentEmail ?? "").toLowerCase(), {
      path: ["newEmail"],
      message: "現在のメールアドレスと同じです",
    });
}
export type RequestEmailChangeInput = z.infer<ReturnType<typeof requestEmailChangeSchema>>;
