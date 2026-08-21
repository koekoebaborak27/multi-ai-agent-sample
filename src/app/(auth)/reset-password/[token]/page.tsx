import Link from "next/link";
import { passwordResetService, ResetPasswordForm } from "@/modules/password-reset";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// パスワード再設定画面（PWR-02）。ログインしていなくても開ける。
// URLの合言葉が有効かどうかをサーバ側で確かめ、無効なら理由を出さずに「開けない」表示にする。
// どの利用者のURLかは、有効・無効いずれの場合も画面に一切出さない。
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const canOpen = await passwordResetService.canOpen(token);

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">
            {canOpen ? "新しいパスワードの設定" : "このURLは使えません"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {canOpen ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                このURLは使用済みか、有効期限が切れています。お手数ですが、もう一度お申し込みください。
              </p>
              <Link
                href="/forgot-password"
                className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
              >
                再発行を申し込む
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
