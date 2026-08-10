import Link from "next/link";
import { redirect } from "next/navigation";
import { MASTER_CATEGORY_SORT_FIELDS, MasterCategoryTable, masterService } from "@/modules/master";
import { parseListQuery } from "@/shared/api/pagination";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { canWrite } from "@/shared/constants/roles";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const dynamic = "force-dynamic";

export default async function MasterCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = parseListQuery(await searchParams, MASTER_CATEGORY_SORT_FIELDS, "code");
  const result = await masterService.listCategories(
    query.page,
    env.PAGE_SIZE,
    query.sort,
    query.order,
  );
  const baseUrl = `/master/categories?sort=${query.sort}&order=${query.order}${query.page > 1 ? `&page=${query.page}` : ""}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">マスタ分類一覧</h1>
        <Button asChild variant="outline">
          <Link href="/master">マスタ一覧へ戻る</Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            全{result.total}件（{result.page} / {result.totalPages}ページ）
          </CardTitle>
          {canWrite(user.role) ? (
            <Button asChild>
              <Link href="/master/categories/new">新規登録</Link>
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <MasterCategoryTable
            categories={result.items}
            sort={query.sort}
            order={query.order}
            baseUrl={baseUrl}
          />

          <nav aria-label="マスタ分類一覧のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link
                  href={`/master/categories?sort=${query.sort}&order=${query.order}&page=${result.page - 1}`}
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
                  href={`/master/categories?sort=${query.sort}&order=${query.order}&page=${result.page + 1}`}
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
