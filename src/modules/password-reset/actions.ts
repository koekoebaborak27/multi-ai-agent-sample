"use server";

import { redirect } from "next/navigation";
import { passwordResetService } from "@/modules/password-reset/service";
import { forgotPasswordSchema, resetPasswordSchema } from "@/modules/password-reset/validation";
import { isAppError } from "@/shared/errors/app-error";
import { withOp } from "@/shared/observability/with-op";

/** 申請フォームの状態。エラーがあればメッセージを、送信済みならその印を画面へ返す */
export interface ForgotPasswordFormState {
  error?: string;
  submitted?: boolean;
}

// パスワード再発行の申請を受け付ける。
// 登録の有無やメール送信の成否を外部から探れないよう、入力の形式さえ正しければ
// 常に「受付完了」を返す（失敗の詳細は shared/mail 側で記録済みのため、ここでは記録し直さない）。
export const requestPasswordResetAction = withOp(
  "password-reset.request",
  async (_prev: ForgotPasswordFormState, formData: FormData): Promise<ForgotPasswordFormState> => {
    const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await passwordResetService.requestReset(parsed.data);
    } catch (e) {
      if (!isAppError(e)) throw e;
    }
    return { submitted: true };
  },
);

/** 再設定フォーム（PWR-02）の状態。エラーがあればメッセージを画面へ返す */
export interface ResetPasswordFormState {
  error?: string;
}

// 新しいパスワードを確定する。
// URLが無効だった場合はエラーメッセージを画面に返し、成功したらログイン画面へ移動する。
// お知らせメールの送信に失敗しても、パスワードの変更自体は成功しているため無視する。
export const resetPasswordAction = withOp(
  "password-reset.reset",
  async (_prev: ResetPasswordFormState, formData: FormData): Promise<ResetPasswordFormState> => {
    const parsed = resetPasswordSchema.safeParse({
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    const token = String(formData.get("token") ?? "");

    try {
      await passwordResetService.resetPassword(token, parsed.data.newPassword);
    } catch (e) {
      if (!isAppError(e)) throw e;
      if (e.code !== "MAIL_SEND_FAILED") return { error: e.userMessage };
    }
    redirect("/login?message=password-reset");
  },
);
