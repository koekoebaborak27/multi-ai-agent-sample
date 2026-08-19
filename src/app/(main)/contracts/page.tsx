import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { parseListQuery } from "@/shared/api/pagination";
import { env } from "@/shared/config/env";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  CONTRACT_SORT_FIELDS,
  contractService,
  ContractTable,
  ContractForm,
} from "@/modules/contract";
import { masterService } from "@/modules/master";
import { partyService } from "@/modules/party";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// ログインの確認とデータベースからの取得が必要なため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// 契約管理画面を表示する。
// 上に新規登録フォーム、下に契約一覧を並べた 1 画面構成になっている。
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡されたページ番号・並び順を使いやすく変換する。
  // 指定が無い場合や、おかしな値が入っていた場合は契約名順にする。
  const query = parseListQuery(await searchParams, CONTRACT_SORT_FIELDS, "title");
  // 契約一覧と、登録フォームの契約先・契約分類プルダウン用の一覧を同時に取得する（待ち時間を短くするため）
  const [result, partyList, categoryOptions] = await Promise.all([
    contractService.list(query.page, env.PAGE_SIZE, query.sort, query.order),
    partyService.list(1, env.PAGE_SIZE),
    masterService.listMasterOptionsByCategoryCode(CONTRACT_CATEGORY_MASTER_CATEGORY_CODE),
  ]);
  // 見出しをクリックして並び替えるときの、リンク先の元になるURL
  const baseUrl = `/contracts?sort=${query.sort}&order=${query.order}${query.page > 1 ? `&page=${query.page}` : ""}`;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">契約管理</h1>

      <Card>
        <CardHeader>
          <CardTitle>契約の新規登録</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractForm parties={partyList.items} categoryOptions={categoryOptions} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            契約一覧（{result.total}件 / {result.page}〜{result.totalPages}ページ）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ContractTable
            contracts={result.items}
            sort={query.sort}
            order={query.order}
            baseUrl={baseUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
