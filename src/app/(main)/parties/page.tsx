import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { parseListQuery } from "@/shared/api/pagination";
import { env } from "@/shared/config/env";
import { PARTY_SORT_FIELDS, partyService, PartyTable, PartyForm } from "@/modules/party";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 認証必須・DB アクセスありのため常に動的レンダリング
export const dynamic = "force-dynamic";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = parseListQuery(await searchParams, PARTY_SORT_FIELDS, "name");
  const result = await partyService.list(query.page, env.PAGE_SIZE, query.sort, query.order);
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
