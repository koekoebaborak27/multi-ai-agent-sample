import Link from "next/link";
import { redirect } from "next/navigation";
import {
  PARTY_COMPANY_TYPE_CATEGORY_CODE,
  partyService,
  PartySearchForm,
  PartyTable,
  partySearchQuerySchema,
  type PartySortField,
} from "@/modules/party";
import { masterService } from "@/modules/master";
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
// 最初の状態（分類「すべて」・1ページ目・名称昇順）と同じ内容はURLに含めず、URLを短く保つ。
function buildListUrl(
  companyTypeId: number | "all",
  keyword: string | undefined,
  page: number,
  sort: PartySortField,
  order: SortOrder,
) {
  const query = new URLSearchParams();
  if (companyTypeId !== "all") query.set("companyTypeId", String(companyTypeId));
  if (keyword) query.set("keyword", keyword);
  if (page > 1) query.set("page", String(page));
  if (sort !== "name") query.set("sort", sort);
  if (order !== "asc") query.set("order", order);
  const queryString = query.toString();
  return queryString ? `/parties?${queryString}` : "/parties";
}

// 契約先検索一覧画面（PTY-01）を表示する。
// ログイン確認 → URLの検索条件を読み取り → 契約先一覧をデータベースから取得、という順に処理して組み立てる。
export default async function PartiesPage({
  searchParams,
}: {
  searchParams: Promise<{
    companyTypeId?: string;
    keyword?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡された検索条件を使いやすく変換する。
  // 文字列のまま渡ってくるので、数値に変換する・値が入っていない項目には初期値を入れる、等を行う。
  const query = partySearchQuerySchema.parse(await searchParams);
  const [result, companyTypeOptions] = await Promise.all([
    partyService.list(
      {
        keyword: query.keyword,
        companyTypeMasterId: query.companyTypeId === "all" ? undefined : query.companyTypeId,
      },
      query.page,
      env.PAGE_SIZE,
      query.sort,
      query.order,
    ),
    masterService.listMasterOptionsByCategoryCode(PARTY_COMPANY_TYPE_CATEGORY_CODE),
  ]);
  // 詳細画面へ渡す「一覧に戻るためのURL」を組み立てる。
  // 今の検索条件・並び順を保ったまま一覧に戻れるよう、確定した検索結果のページ番号を使う。
  const returnTo = buildListUrl(
    query.companyTypeId,
    query.keyword,
    result.page,
    query.sort,
    query.order,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約先管理</h1>

      <PartySearchForm
        key={`${query.companyTypeId}:${query.keyword ?? ""}`}
        companyTypeOptions={companyTypeOptions}
        initialCompanyTypeId={query.companyTypeId}
        initialKeyword={query.keyword}
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
              <Link href={`/parties/new?returnTo=${encodeURIComponent(returnTo)}`}>新規登録</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <PartyTable
            parties={result.items}
            returnTo={returnTo}
            sort={query.sort}
            order={query.order}
          />

          <nav aria-label="契約先検索結果のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildListUrl(
                    query.companyTypeId,
                    query.keyword,
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
                    query.companyTypeId,
                    query.keyword,
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
