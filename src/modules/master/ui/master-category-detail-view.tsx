import Link from "next/link";
import type { MasterCategoryDetail } from "@/modules/master/types";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 日時の表示形式。
// 表示する端末の設定に左右されず、どの環境でも同じ日本時間・同じ書式で表示されるよう、
// 言語とタイムゾーンを固定している。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

interface MasterCategoryDetailViewProps {
  category: MasterCategoryDetail;
  canWrite: boolean;
  successMessage?: string;
}

// マスタ分類1件の詳細を表示する。
// 登録・更新の直後にもこの画面へ移動してくるため、その場合は successMessage に完了メッセージが入る。
// 更新ボタンは、更新の権限を持つ利用者にだけ表示する。
export function MasterCategoryDetailView({
  category,
  canWrite,
  successMessage,
}: MasterCategoryDetailViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ分類詳細</h1>

      {successMessage ? (
        <p
          role="status"
          className="rounded-lg border border-border bg-muted p-4 text-sm font-medium"
        >
          {successMessage}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>マスタ分類コード: {category.code}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium text-muted-foreground">マスタ分類コード</dt>
            <dd className="font-mono text-sm">{category.code}</dd>
            <dt className="text-sm font-medium text-muted-foreground">マスタ分類名</dt>
            <dd className="text-sm break-words">{category.name}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録マスタ件数</dt>
            <dd className="text-sm tabular-nums">{category.masterCount}件</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(category.createdAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録者</dt>
            <dd className="text-sm break-words">{category.createdBy ?? "—"}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(category.updatedAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新者</dt>
            <dd className="text-sm break-words">{category.updatedBy ?? "—"}</dd>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href="/master/categories">一覧へ戻る</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href={`/master/categories/${category.id}/edit`}>更新する</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
