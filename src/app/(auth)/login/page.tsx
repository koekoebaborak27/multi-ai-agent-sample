import { redirect } from "next/navigation";
import { auth, LoginForm } from "@/modules/auth";
import { isEntraConfigured } from "@/shared/config/env";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">サンプル契約管理システム</CardTitle>
          <CardDescription>ログインしてください</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm entraEnabled={isEntraConfigured} />
        </CardContent>
      </Card>
    </main>
  );
}
