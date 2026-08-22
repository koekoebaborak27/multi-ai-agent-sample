import Link from "next/link";
import { redirect } from "next/navigation";
import { passwordResetService } from "@/modules/password-reset";
import { getCurrentUser } from "@/shared/auth/session";
import { isAppError } from "@/shared/errors/app-error";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// メールアドレス変更の確認画面（EML-02）。
// この画面を開いた時点で確認が完了する（別途「確定」ボタンは無い）。ログインしている必要があり、
// 未ログインなら src/proxy.ts がログイン画面へ送るが、万一そこを通らなかった場合に備えて二重に確認する。
export default async function ConfirmEmailChangePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let newEmail: string | null = null;
  let errorMessage: string | null = null;
  try {
    newEmail = await passwordResetService.confirmEmailChange(token, user.id);
  } catch (e) {
    if (!isAppError(e)) throw e;
    errorMessage = e.userMessage;
  }

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">メールアドレス変更</h1>
      <Card>
        <CardHeader>
          <CardTitle>{newEmail ? "変更が完了しました" : "このURLは使えません"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {newEmail ? (
            <p className="text-sm">
              メールアドレスを変更しました。新しいメールアドレス: {newEmail}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          )}
          <Link
            href="/settings/email"
            className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            メールアドレス設定へ戻る
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
