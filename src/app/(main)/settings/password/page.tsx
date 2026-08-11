import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { PasswordChangeForm } from "@/modules/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

// パスワード変更画面を表示する。
// 初回ログインで変更が必要な利用者は src/proxy.ts によってこの画面へ案内されるため、
// その場合は理由が分かるよう画面上に案内文を出す。
export default async function PasswordSettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-md space-y-6">
      <h1 className="text-2xl font-bold">パスワード変更</h1>
      <Card>
        <CardHeader>
          <CardTitle>パスワードの変更</CardTitle>
          {user.mustChangePassword && (
            <CardDescription className="text-destructive">
              初回ログインのため、パスワードの変更が必要です。
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <PasswordChangeForm />
        </CardContent>
      </Card>
    </div>
  );
}
