"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/modules/auth/auth";
import { authService } from "@/modules/auth/service";
import { credentialsLoginSchema, passwordChangeSchema } from "@/modules/auth/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { isAppError } from "@/shared/errors/app-error";
import { MESSAGES } from "@/shared/constants/messages";

export interface FormState {
  error?: string;
}

/** ID/PW ログイン。成功時は "/" にリダイレクト（proxy が初回PW変更へ誘導）。 */
export const loginWithCredentials = withOp(
  "auth.login",
  async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const parsed = credentialsLoginSchema.safeParse({
      userId: formData.get("userId"),
      password: formData.get("password"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? MESSAGES.auth.invalidCredentials };
    }
    try {
      await signIn("credentials", {
        userId: parsed.data.userId,
        password: parsed.data.password,
        redirectTo: "/",
      });
      return {};
    } catch (e) {
      if (e instanceof AuthError) {
        return { error: MESSAGES.auth.invalidCredentials };
      }
      throw e; // NEXT_REDIRECT 等は再スロー
    }
  },
);

/** パスワード変更（初回強制変更を含む）。成功時 "/" へ。 */
export const changePassword = withOp(
  "auth.change-password",
  async (_prev: FormState, formData: FormData): Promise<FormState> => {
    const user = await getCurrentUser();
    if (!user) return { error: MESSAGES.auth.loginRequired };

    const parsed = passwordChangeSchema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }

    try {
      await authService.changePassword(
        user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
    } catch (e) {
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // セッションのクレーム更新のため再ログインを促す
    await signOut({ redirectTo: "/login" });
    return {};
  },
);

/** Entra ID ログイン（OIDC リダイレクト開始） */
export const loginWithEntra = withOp("auth.login.entra", async (): Promise<void> => {
  await signIn("microsoft-entra-id", { redirectTo: "/" });
});

/** ログアウト */
export const signOutAction = withOp("auth.logout", async (): Promise<void> => {
  await signOut({ redirectTo: "/login" });
});
