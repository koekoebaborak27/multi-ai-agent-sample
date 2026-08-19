import Link from "next/link";
import { CONTRACT_STATUS_LABELS, type ContractDetail } from "@/modules/contract/types";
import { ContractDeleteDialog } from "@/modules/contract/ui/contract-delete-dialog";
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

/** 日付を「2026-08-12」の形にする。開始日・終了日が未定の場合は「未定」を表示する */
function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "未定";
}

interface ContractDetailViewProps {
  contract: ContractDetail;
  returnTo: string;
  canWrite: boolean;
  successMessage?: string;
}

// 契約1件の詳細を表示する（CTR-04）。
// 登録・更新の直後にもこの画面へ移動してくるため、その場合はsuccessMessageに完了メッセージが入る。
// 契約先名は契約先詳細画面（PTY-04）へのリンクとする（逆方向のリンクは張らない。§00.5）。
export function ContractDetailView({
  contract,
  returnTo,
  canWrite,
  successMessage,
}: ContractDetailViewProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約詳細</h1>

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
          <CardTitle>{contract.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
            <dt className="text-sm font-medium text-muted-foreground">契約名</dt>
            <dd className="text-sm break-words">{contract.title}</dd>
            <dt className="text-sm font-medium text-muted-foreground">契約分類</dt>
            <dd className="text-sm break-words">{contract.categoryLabel}</dd>
            <dt className="text-sm font-medium text-muted-foreground">契約先</dt>
            <dd className="text-sm break-words">
              <Link href={`/parties/${contract.partyId}`} className="underline underline-offset-4">
                {contract.partyName}
              </Link>
            </dd>
            <dt className="text-sm font-medium text-muted-foreground">開始日</dt>
            <dd className="text-sm tabular-nums">{formatDate(contract.startDate)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">終了日</dt>
            <dd className="text-sm tabular-nums">{formatDate(contract.endDate)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">状態</dt>
            <dd className="text-sm break-words">
              {CONTRACT_STATUS_LABELS[contract.status as keyof typeof CONTRACT_STATUS_LABELS] ??
                contract.status}
            </dd>
            <dt className="text-sm font-medium text-muted-foreground">登録日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(contract.createdAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">登録者</dt>
            {/* 登録者が記録されていない過去のデータもあるため、その場合は「—」を表示する */}
            <dd className="text-sm break-words">{contract.createdBy ?? "—"}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新日時</dt>
            <dd className="text-sm tabular-nums">{dateTimeFormatter.format(contract.updatedAt)}</dd>
            <dt className="text-sm font-medium text-muted-foreground">最終更新者</dt>
            <dd className="text-sm break-words">{contract.updatedBy ?? "—"}</dd>
          </dl>

          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline">
              <Link href={returnTo}>一覧へ戻る</Link>
            </Button>
            {canWrite ? (
              <Button asChild>
                <Link
                  href={`/contracts/${contract.id}/edit?returnTo=${encodeURIComponent(returnTo)}`}
                >
                  編集する
                </Link>
              </Button>
            ) : null}
            {canWrite ? (
              <ContractDeleteDialog
                contractId={contract.id}
                title={contract.title}
                partyName={contract.partyName}
                updatedAt={contract.updatedAt.toISOString()}
                returnTo={returnTo}
              />
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
