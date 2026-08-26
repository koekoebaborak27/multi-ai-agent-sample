import Link from "next/link";
import { redirect } from "next/navigation";
import {
  NewsSearchForm,
  NewsTable,
  NewsCreateDialog,
  NewsDeletedToast,
  newsSearchQuerySchema,
  newsService,
  type NewsCategory,
  type NewsSortField,
} from "@/modules/news";
import type { SortOrder } from "@/shared/api/pagination";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// 次の工程で追加する一覧を常に最新の状態で見せられるようにしておく。
export const dynamic = "force-dynamic";

// 検索条件・ページ番号・並び順を一覧用のURLへまとめる。
// 初期状態と同じ内容はURLに含めず、検索条件を共有しやすい短いURLにする。
function buildListUrl(
  category: NewsCategory | undefined,
  keyword: string | undefined,
  page: number,
  sort: NewsSortField,
  order: SortOrder,
) {
  const query = new URLSearchParams();
  if (category) query.set("category", category);
  if (keyword) query.set("keyword", keyword);
  if (page > 1) query.set("page", String(page));
  if (sort !== "startAt") query.set("sort", sort);
  if (order !== "desc") query.set("order", order);
  const queryString = query.toString();
  return queryString ? `/news?${queryString}` : "/news";
}

// お知らせ管理画面（NEWS-02）を表示する。
// URLの検索条件を読み取り、検索済みの一覧を組み立てる。
export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    keyword?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  // 未ログイン時は、画面のデータを取得する前にログイン画面へ移動させる。
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // URLから渡される文字列を、検索・並び替えで使える安全な値へ変換する。
  const query = newsSearchQuerySchema.parse(await searchParams);
  const result = await newsService.listNews(
    { category: query.category, keyword: query.keyword },
    query.page,
    env.PAGE_SIZE,
    query.sort,
    query.order,
  );
  // 見出しの並び替えとページ送りで、今の条件・実際に表示したページを維持する。
  const listUrl = buildListUrl(query.category, query.keyword, result.page, query.sort, query.order);

  return (
    <div className="space-y-6">
      <NewsDeletedToast />
      <h1 className="text-3xl font-semibold tracking-tight">お知らせ管理</h1>

      <NewsSearchForm
        key={`${query.category ?? "all"}:${query.keyword ?? ""}`}
        initialCategory={query.category}
        initialKeyword={query.keyword}
        currentSort={query.sort}
        currentOrder={query.order}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            検索結果 全{result.total}件（{result.page} / {result.totalPages}ページ）
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-end">
            <NewsCreateDialog />
          </div>
          <NewsTable news={result.items} baseUrl={listUrl} sort={query.sort} order={query.order} />

          <nav aria-label="お知らせ検索結果のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildListUrl(
                    query.category,
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
                    query.category,
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
