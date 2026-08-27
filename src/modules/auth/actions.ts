"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/modules/auth/auth";
import { authService } from "@/modules/auth/service";
import { credentialsLoginSchema, passwordChangeSchema } from "@/modules/auth/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { isAppError } from "@/shared/errors/app-error";
import { MESSAGES } from "@/shared/constants/messages";

// Auth.jsはログイン処理中に起きたエラーを、内容を問わず同じ形（AuthError）へ包み直す。
// 包む前の本来のエラー（業務上のAppError）は cause.err に入っているため、そこから取り出す。
function unwrapAuthErrorCause(e: AuthError): unknown {
  const cause = e.cause as { err?: unknown } | undefined;
  return cause?.err;
}

/** ログイン・パスワード変更フォームの状態。エラーがあればメッセージを入れて画面へ返す */
export interface FormState {
  error?: string;
}

// ID とパスワードでログインする。
// 成功したらトップ画面へ移動する。初回ログインの場合は、その後 src/proxy.ts が
// パスワード変更画面へ案内するため、ここでは行き先を分けていない。
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
        // ロック済みの場合だけは、管理者へ問い合わせるよう案内する専用の文言を返す。
        // それ以外（ID・パスワードの誤り）は、どちらが違うのかを伝えず同じメッセージで返す。
        // どちらなのかを伝えると、存在する ID を探り当てる手がかりを与えてしまうため。
        const cause = unwrapAuthErrorCause(e);
        if (isAppError(cause) && cause.code === "ACCOUNT_LOCKED") {
          return { error: cause.userMessage };
        }
        return { error: MESSAGES.auth.invalidCredentials };
      }
      // 画面移動の指示もエラーと同じ仕組みで通知されるため、ここで止めずにそのまま渡す
      throw e;
    }
  },
);

// パスワードを変更する。初回ログイン時の変更でも同じ処理を使う。
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
    // ログイン状態を保つ引換券には「初回パスワード変更が必要」の情報が入っている。
    // 変更後もその情報は古いままなので、いったんログアウトして入り直してもらう。
    await signOut({ redirectTo: "/login" });
    return {};
  },
);

// Microsoft アカウントでのログインを開始する。
// この後は Microsoft 側のログイン画面へ移動し、完了するとこのアプリに戻ってくる。
export const loginWithEntra = withOp("auth.login.entra", async (): Promise<void> => {
  await signIn("microsoft-entra-id", { redirectTo: "/" });
});

// ログアウトし、ログイン画面へ移動する。
export const signOutAction = withOp("auth.logout", async (): Promise<void> => {
  await signOut({ redirectTo: "/login" });
});
