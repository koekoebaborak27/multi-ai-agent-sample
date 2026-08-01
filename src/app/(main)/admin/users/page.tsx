import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { ROLES } from "@/shared/constants/roles";
import { env } from "@/shared/config/env";
import { userService, UserTable, UserForm } from "@/modules/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 認証必須・DB アクセスありのため常に動的レンダリング
export const dynamic = "force-dynamic";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== ROLES.ADMIN) redirect("/"); // ADMIN 限定

  const { page } = await searchParams;
  const result = await userService.list(Number(page ?? 1), env.PAGE_SIZE);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ユーザー管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>ユーザー新規作成</CardTitle>
        </CardHeader>
        <CardContent>
          <UserForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            ユーザー一覧（{result.total}件 / {result.page}〜{result.totalPages}ページ）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <UserTable users={result.items} />
        </CardContent>
      </Card>
    </div>
  );
}
