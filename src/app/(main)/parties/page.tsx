import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { parseListQuery } from "@/shared/api/pagination";
import { env } from "@/shared/config/env";
import { PARTY_SORT_FIELDS, partyService, PartyTable, PartyForm } from "@/modules/party";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// ログインの確認とデータベースからの取得が必要なため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// 契約先管理画面を表示する。
// 上に新規登録フォーム、下に契約先一覧を並べた 1 画面構成になっている。
export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡されたページ番号・並び順を使いやすく変換する。
  // 指定が無い場合や、おかしな値が入っていた場合は名称順にする。
  const query = parseListQuery(await searchParams, PARTY_SORT_FIELDS, "name");
  const result = await partyService.list(query.page, env.PAGE_SIZE, query.sort, query.order);
  // 見出しをクリックして並び替えるときの、リンク先の元になるURL
  const baseUrl = `/parties?sort=${query.sort}&order=${query.order}${query.page > 1 ? `&page=${query.page}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約先管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>契約先の新規登録</CardTitle>
        </CardHeader>
        <CardContent>
          <PartyForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            契約先一覧（{result.total}件 / {result.page}〜{result.totalPages}ページ）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PartyTable
            parties={result.items}
            sort={query.sort}
            order={query.order}
            baseUrl={baseUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
