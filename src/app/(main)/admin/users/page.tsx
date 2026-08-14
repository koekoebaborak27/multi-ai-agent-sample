import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { parseListQuery } from "@/shared/api/pagination";
import { ROLES } from "@/shared/constants/roles";
import { env } from "@/shared/config/env";
import { USER_SORT_FIELDS, userService, UserTable, UserForm } from "@/modules/user";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// ログインの確認とデータベースからの取得が必要なため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// ユーザー管理画面を表示する（管理者向け）。
// 上に新規作成フォーム、下に利用者一覧を並べた 1 画面構成になっている。
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // 管理者以外がURLを直接開いた場合はトップ画面へ戻す
  if (user.role !== ROLES.ADMIN) redirect("/");

  // リクエストで渡されたページ番号・並び順を使いやすく変換する。
  // 指定が無い場合や、おかしな値が入っていた場合はユーザーID順にする。
  const query = parseListQuery(await searchParams, USER_SORT_FIELDS, "userId");
  const result = await userService.list(query.page, env.PAGE_SIZE, query.sort, query.order);
  // 見出しをクリックして並び替えるときの、リンク先の元になるURL
  const baseUrl = `/admin/users?sort=${query.sort}&order=${query.order}${query.page > 1 ? `&page=${query.page}` : ""}`;

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
          <UserTable users={result.items} sort={query.sort} order={query.order} baseUrl={baseUrl} />
        </CardContent>
      </Card>
    </div>
  );
}
