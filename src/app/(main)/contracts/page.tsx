import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  contractService,
  ContractDeletedToast,
  ContractSearchForm,
  ContractTable,
  contractSearchQuerySchema,
  type ContractSortField,
  type ContractStatus,
} from "@/modules/contract";
import { masterService } from "@/modules/master";
import { partyService } from "@/modules/party";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { env } from "@/shared/config/env";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// 検索結果を常に最新の状態で見せたいため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// 検索条件・ページ番号・並び順を1本のURLにまとめる。
// 詳細画面へ渡す「一覧に戻るためのURL」や、並び替え・ページ送りのリンク先を作るために使う。
// 最初の状態（すべて「すべて」・1ページ目・契約名昇順）と同じ内容はURLに含めず、URLを短く保つ。
function buildListUrl(
  partyId: string | "all",
  status: ContractStatus | "all",
  categoryId: number | "all",
  page: number,
  sort: ContractSortField,
  order: SortOrder,
) {
  const query = new URLSearchParams();
  if (partyId !== "all") query.set("partyId", partyId);
  if (status !== "all") query.set("status", status);
  if (categoryId !== "all") query.set("categoryId", String(categoryId));
  if (page > 1) query.set("page", String(page));
  if (sort !== "title") query.set("sort", sort);
  if (order !== "asc") query.set("order", order);
  const queryString = query.toString();
  return queryString ? `/contracts?${queryString}` : "/contracts";
}

// 契約検索一覧画面（CTR-01）を表示する。
// ログイン確認 → URLの検索条件を読み取り → 契約一覧をデータベースから取得、という順に処理して組み立てる。
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{
    partyId?: string;
    status?: string;
    categoryId?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡された検索条件を使いやすく変換する。
  const query = contractSearchQuerySchema.parse(await searchParams);
  const [result, partyList, categoryOptions] = await Promise.all([
    contractService.list(
      {
        partyId: query.partyId === "all" ? undefined : query.partyId,
        status: query.status === "all" ? undefined : query.status,
        categoryMasterId: query.categoryId === "all" ? undefined : query.categoryId,
      },
      query.page,
      env.PAGE_SIZE,
      query.sort,
      query.order,
    ),
    // 契約先コンボボックスの選択肢用に、登録済みの契約先を全件取得する（クライアント側で絞り込む。§00.9.2）
    partyService.list({}, 1, env.PAGE_SIZE),
    masterService.listMasterOptionsByCategoryCode(CONTRACT_CATEGORY_MASTER_CATEGORY_CODE),
  ]);
  // 詳細画面へ渡す「一覧に戻るためのURL」を組み立てる。
  const returnTo = buildListUrl(
    query.partyId,
    query.status,
    query.categoryId,
    result.page,
    query.sort,
    query.order,
  );

  return (
    <div className="space-y-6">
      <ContractDeletedToast />
      <h1 className="text-3xl font-semibold tracking-tight">契約管理</h1>

      <ContractSearchForm
        partyOptions={partyList.items.map((p) => ({ id: p.id, name: p.name }))}
        categoryOptions={categoryOptions}
        initialPartyId={query.partyId}
        initialStatus={query.status}
        initialCategoryId={query.categoryId}
        currentSort={query.sort}
        currentOrder={query.order}
      />

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            検索結果 全{result.total}件（{result.page} / {result.totalPages}ページ）
          </CardTitle>
          {canWrite(user.role) ? (
            <Button asChild>
              <Link href={`/contracts/new?returnTo=${encodeURIComponent(returnTo)}`}>新規登録</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <ContractTable
            contracts={result.items}
            returnTo={returnTo}
            sort={query.sort}
            order={query.order}
          />

          <nav aria-label="契約検索結果のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildListUrl(
                    query.partyId,
                    query.status,
                    query.categoryId,
                    result.page - 1,
                    query.sort,
                    query.order,
                  )}
                >
                  前へ
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                前へ
              </Button>
            )}
            {result.page < result.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildListUrl(
                    query.partyId,
                    query.status,
                    query.categoryId,
                    result.page + 1,
                    query.sort,
                    query.order,
                  )}
                >
                  次へ
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                次へ
              </Button>
            )}
          </nav>
        </CardContent>
      </Card>
    </div>
  );
}
