import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { passwordResetService, RequestEmailChangeForm } from "@/modules/password-reset";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// メールアドレス変更申し込み画面（EML-01）を表示する。
// 現在のメールアドレスは、ログイン中の情報ではなく毎回データベースから取り直す。
// ログイン状態を保つ引換券の中身は変更が反映されないため、そのまま使うと変更直後に古いアドレスが出てしまう。
export default async function EmailSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const currentEmail = await passwordResetService.getCurrentEmail(user.id);

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">メールアドレス変更</h1>
      <Card>
        <CardHeader>
          <CardTitle>メールアドレスの変更</CardTitle>
        </CardHeader>
        <CardContent>
          <RequestEmailChangeForm currentEmail={currentEmail} />
        </CardContent>
      </Card>
    </div>
  );
}
