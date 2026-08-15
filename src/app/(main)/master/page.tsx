import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MASTER_EXPORT_MAX_ROWS,
  MasterDeletedToast,
  MasterExportButton,
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

// ページを毎回サーバー側で作り直す設定。
// 検索結果を常に最新の状態で見せたいため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// 検索条件・ページ番号・並び順を1本のURLにまとめる。
// 一覧画面に戻るリンクや、並び替え・ページ送りのリンク先を作るために使う。
// 最初の状態（1ページ目・分類名順）と同じ内容はURLに含めず、URLを短く保つ。
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

// マスタ一覧画面を表示する。
// ログイン確認 → URLの検索条件を読み取り → マスタ一覧をデータベースから取得、
// という順に処理して画面を組み立てる。
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
  // ログインしていなければログイン画面へ移動させる。
  // この画面自体は、見るだけなら権限を問わない。
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // リクエストで渡された検索条件を使いやすく変換する。
  // 文字列のまま渡ってくるので、数値に変換する・値が入っていない項目には初期値を入れる、等を行う。
  const query = masterSearchQuerySchema.parse(await searchParams);
  // 検索条件の分類プルダウン用に、分類の一覧を取得する。
  // 毎回最新の内容にしたいので、都度データベースから取得する。
  const categories = await masterService.listCategoryOptions();
  // URLで指定された分類を選択状態にする。
  // 「all」ならそのまま「すべて」として扱う。指定された分類が実際には存在しない場合
  // （分類が削除された後の古いリンクなど）は、代わりに分類一覧の一番先頭の分類を選択状態にする。
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
  // 詳細画面へ渡す「一覧に戻るためのURL」を組み立てる。
  // 今の検索条件・ページ・並び順を保ったまま一覧に戻れるよう、確定した検索結果のページ番号を使う。
  const returnTo = buildListUrl(
    selectedCategoryId,
    query.keyword,
    result.page,
    query.sort,
    query.order,
  );

  // CSVダウンロードは今の検索条件のままの対象を出力する。
  // ダウンロード用Route Handlerへ渡す条件をここでクエリパラメータとして組み立てる。
  const exportQuery = new URLSearchParams();
  exportQuery.set("categoryId", String(selectedCategoryId ?? "all"));
  if (query.keyword) exportQuery.set("keyword", query.keyword);
  const exportHref = `/api/master/exports/csv?${exportQuery.toString()}`;
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
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">マスタ管理</h1>
        <Button asChild>
          <Link href="/master/categories">マスタ分類の管理</Link>
        </Button>
      </div>

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
            <MasterExportButton
              href={exportHref}
              disabled={exportDisabled}
              disabledReason={exportDisabledReason}
            />
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
