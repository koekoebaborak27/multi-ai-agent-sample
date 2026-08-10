import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MasterSearchForm,
  MasterTable,
  type MasterSortField,
  masterSearchQuerySchema,
  masterService,
} from "@/modules/master";
import type { SortOrder } from "@/shared/api/pagination";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { canWrite } from "@/shared/constants/roles";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const dynamic = "force-dynamic";

function buildListUrl(
  categoryId: number | "all" | undefined,
  keyword: string | undefined,
  page: number,
  sort: MasterSortField,
  order: SortOrder,
) {
  const query = new URLSearchParams();
  if (categoryId !== undefined) query.set("categoryId", String(categoryId));
  if (keyword) query.set("keyword", keyword);
  if (page > 1) query.set("page", String(page));
  if (sort !== "category") query.set("sort", sort);
  if (order !== "asc") query.set("order", order);
  const queryString = query.toString();
  return queryString ? `/master?${queryString}` : "/master";
}

export default async function MasterPage({
  searchParams,
}: {
  searchParams: Promise<{
    categoryId?: string;
    keyword?: string;
    page?: string;
    sort?: string;
    order?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = masterSearchQuerySchema.parse(await searchParams);
  const categories = await masterService.listCategoryOptions();
  const selectedCategoryId =
    query.categoryId === "all"
      ? "all"
      : categories.some((category) => category.id === query.categoryId)
        ? query.categoryId
        : categories[0]?.id;
  const criteria = {
    categoryId: typeof selectedCategoryId === "number" ? selectedCategoryId : undefined,
    keyword: query.keyword,
  };
  const result = await masterService.listMasters(
    criteria,
    query.page,
    env.PAGE_SIZE,
    query.sort,
    query.order,
  );
  const returnTo = buildListUrl(
    selectedCategoryId,
    query.keyword,
    result.page,
    query.sort,
    query.order,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ管理</h1>

      <MasterSearchForm
        key={`${selectedCategoryId ?? "all"}:${query.keyword ?? ""}`}
        categories={categories}
        initialCategoryId={typeof selectedCategoryId === "number" ? selectedCategoryId : undefined}
        defaultCategoryId={categories[0]?.id}
        initialKeyword={query.keyword}
        currentSort={query.sort}
        currentOrder={query.order}
      />

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            検索結果 全{result.total}件（{result.page} / {result.totalPages}ページ）
          </CardTitle>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline">
              <Link href="/master/categories">マスタ分類の管理</Link>
            </Button>
            {canWrite(user.role) ? (
              <Button asChild>
                <Link href={`/master/new?returnTo=${encodeURIComponent(returnTo)}`}>新規登録</Link>
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <MasterTable
            masters={result.items}
            returnTo={returnTo}
            sort={query.sort}
            order={query.order}
          />

          <nav aria-label="マスタ検索結果のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={buildListUrl(
                    selectedCategoryId,
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
                    selectedCategoryId,
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
