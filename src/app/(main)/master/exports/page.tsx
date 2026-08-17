import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MasterExcelExportRefresh,
  MasterExcelExportRunButton,
  MasterExcelExportTable,
  masterExcelExportListQuerySchema,
  masterService,
} from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { env } from "@/shared/config/env";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// 実行履歴を常に最新の状態で見せたいため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// マスタ情報Excel取得（MST-11）画面を表示する。
// ログイン確認 → URLのページ番号を読み取り → 実行履歴一覧をデータベースから取得、
// という順に処理して画面を組み立てる。
// 設計書§40.4により、閲覧・実行・他人の履歴閲覧・ダウンロードのすべてを全ロールが行えるため、
// 書き込み権限（canWrite）の確認は行わず、ログインしていることだけを確認する。
export default async function MasterExcelExportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const query = masterExcelExportListQuerySchema.parse(await searchParams);
  const result = await masterService.listExcelExports(query.page, env.PAGE_SIZE);
  const hasPending = result.items.some(
    (item) => item.status === "QUEUED" || item.status === "RUNNING",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-semibold tracking-tight">マスタ情報Excel取得</h1>
        <Button asChild variant="outline">
          <Link href="/master">マスタ管理へ戻る</Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        マスタ分類とマスタの情報をExcelファイルにまとめて出力します。作成には3〜5分ほどかかります。
        できあがったら、下の一覧の「ダウンロード」から取得してください。
      </p>

      <MasterExcelExportRunButton />

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle>
            実行履歴 全{result.total}件（{result.page} / {result.totalPages}ページ）
          </CardTitle>
          <MasterExcelExportRefresh hasPending={hasPending} />
        </CardHeader>
        <CardContent className="space-y-4">
          <MasterExcelExportTable items={result.items} />

          <nav aria-label="実行履歴一覧のページ移動" className="flex justify-end gap-2">
            {result.page > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/master/exports?page=${result.page - 1}`}>前へ</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                前へ
              </Button>
            )}
            {result.page < result.totalPages ? (
              <Button asChild variant="outline" size="sm">
                <Link href={`/master/exports?page=${result.page + 1}`}>次へ</Link>
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
