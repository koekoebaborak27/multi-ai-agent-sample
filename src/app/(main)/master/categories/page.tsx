import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MASTER_CATEGORY_SORT_FIELDS,
  MASTER_EXPORT_MAX_ROWS,
  MasterCategoryTable,
  MasterDeletedToast,
  MasterExportButton,
  masterService,
  requestMasterCategoryExportAction,
} from "@/modules/master";
import { parseListQuery } from "@/shared/api/pagination";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { canWrite } from "@/shared/constants/roles";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// 一覧を常に最新の状態で見せたいため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// マスタ分類一覧画面を表示する。
// ログイン確認 → URLのページ・並び順を読み取り → 分類一覧をデータベースから取得、
// という順に処理して画面を組み立てる。マスタ一覧と違い、検索条件による絞り込みは無い。
export default async function MasterCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; sort?: string; order?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡されたページ番号・並び順を使いやすく変換する。
  // 指定が無い場合や、おかしな値が入っていた場合は分類コード順にする。
  const query = parseListQuery(await searchParams, MASTER_CATEGORY_SORT_FIELDS, "code");
  const result = await masterService.listCategories(
    query.page,
    env.PAGE_SIZE,
    query.sort,
    query.order,
  );
  // 見出しをクリックして並び替えるときの、リンク先の元になるURL。
  // 今の並び順とページ番号を保った状態を表す。
  const baseUrl = `/master/categories?sort=${query.sort}&order=${query.order}${query.page > 1 ? `&page=${query.page}` : ""}`;

  // マスタ分類には検索条件が無いため、常に全件が対象になる（§13.5.1）。
  const exportDisabled = result.total === 0 || result.total > MASTER_EXPORT_MAX_ROWS;
  const exportDisabledReason =
    result.total === 0
      ? "対象のデータがありません"
      : result.total > MASTER_EXPORT_MAX_ROWS
        ? `対象が${result.total}件あります。${MASTER_EXPORT_MAX_ROWS}件以下になるよう検索条件で絞り込んでください`
        : undefined;

  return (
    <div className="space-y-6">
      <MasterDeletedToast />
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
          <div className="flex flex-col gap-2 sm:flex-row">
            <MasterExportButton
              action={requestMasterCategoryExportAction}
              disabled={exportDisabled}
              disabledReason={exportDisabledReason}
            />
            {canWrite(user.role) ? (
              <Button asChild>
                <Link href="/master/categories/new">新規登録</Link>
              </Button>
            ) : null}
          </div>
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
