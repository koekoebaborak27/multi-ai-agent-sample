import { ForgotPasswordForm } from "@/modules/password-reset";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// パスワード再発行の申請画面（PWR-01）。ログインしていなくても開ける。
export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">パスワードの再設定</CardTitle>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  );
}
