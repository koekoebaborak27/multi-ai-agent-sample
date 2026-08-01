import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { partyService, PartyTable, PartyForm } from "@/modules/party";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 認証必須・DB アクセスありのため常に動的レンダリング
export const dynamic = "force-dynamic";

export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { page } = await searchParams;
  const result = await partyService.list(Number(page ?? 1), env.PAGE_SIZE);

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
          <PartyTable parties={result.items} />
        </CardContent>
      </Card>
    </div>
  );
}
