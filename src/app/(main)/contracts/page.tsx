import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { contractService, ContractTable, ContractForm } from "@/modules/contract";
import { partyService } from "@/modules/party";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 認証必須・DB アクセスありのため常に動的レンダリング
export const dynamic = "force-dynamic";

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { page } = await searchParams;
  const [result, partyList] = await Promise.all([
    contractService.list(Number(page ?? 1), env.PAGE_SIZE),
    partyService.list(1, env.PAGE_SIZE),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>契約の新規登録</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractForm parties={partyList.items} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            契約一覧（{result.total}件 / {result.page}〜{result.totalPages}ページ）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTable contracts={result.items} />
        </CardContent>
      </Card>
    </div>
  );
}
