import Link from "next/link";
import type { PartyDetail } from "@/modules/party/types";
import { PartyDeleteDialog } from "@/modules/party/ui/party-delete-dialog";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 日時の表示形式。
// 表示する端末の設定に左右されず、どの環境でも同じ日本時間・同じ書式で表示されるよう、
// 言語とタイムゾーンを固定している（マスタ詳細画面と同じ）。
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

interface PartyDetailViewProps {
  party: PartyDetail;
  returnTo: string;
  canWrite: boolean;
  successMessage?: string;
}

// 契約先1件の詳細を表示する（PTY-04）。
// 登録・更新の直後にもこの画面へ移動してくるため、その場合はsuccessMessageに完了メッセージが入る。
// 紐づく契約の一覧は表示しない（要件定義で対象外と確定済み。§00.1）。
export function PartyDetailView({
  party,
  returnTo,
  canWrite,
  successMessage,
}: PartyDetailViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約先詳細</h1>

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
          <CardTitle>{party.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium text-muted-foreground">名称</dt>
            <dd className="text-sm break-words">{party.name}</dd>
            <dt className="text-sm font-medium text-muted-foreground">分類</dt>
            <dd className="text-sm break-words">{party.companyTypeLabel}</dd>
            <dt className="text-sm font-medium text-muted-foreground">連絡先</dt>
            <dd className="text-sm break-words">{party.contactInfo ?? "-"}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(party.createdAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録者</dt>
            {/* 登録者が記録されていない過去のデータもあるため、その場合は「—」を表示する */}
            <dd className="text-sm break-words">{party.createdBy ?? "—"}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(party.updatedAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新者</dt>
            <dd className="text-sm break-words">{party.updatedBy ?? "—"}</dd>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={returnTo}>一覧へ戻る</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link href={`/parties/${party.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}>
                  編集する
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <PartyDeleteDialog
                partyId={party.id}
                name={party.name}
                companyTypeLabel={party.companyTypeLabel}
                updatedAt={party.updatedAt.toISOString()}
                returnTo={returnTo}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
