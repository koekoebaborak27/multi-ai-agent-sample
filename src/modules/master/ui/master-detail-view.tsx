import Link from "next/link";
import type { MasterDetail } from "@/modules/master/types";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

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

interface MasterDetailViewProps {
  master: MasterDetail;
  returnTo: string;
  canWrite: boolean;
  successMessage?: string;
}

export function MasterDetailView({
  master,
  returnTo,
  canWrite,
  successMessage,
}: MasterDetailViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ詳細</h1>

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
          <CardTitle>マスタコード: {master.code}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium text-muted-foreground">マスタ分類</dt>
            <dd className="text-sm break-words">{master.categoryName}</dd>
            <dt className="text-sm font-medium text-muted-foreground">マスタコード</dt>
            <dd className="font-mono text-sm">{master.code}</dd>
            <dt className="text-sm font-medium text-muted-foreground">マスタ内容</dt>
            <dd className="text-sm break-words">{master.content}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(master.createdAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録者</dt>
            <dd className="text-sm break-words">{master.createdBy ?? "—"}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(master.updatedAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新者</dt>
            <dd className="text-sm break-words">{master.updatedBy ?? "—"}</dd>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={returnTo}>一覧へ戻る</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href={`/master/${master.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>
                  更新する
                </Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
