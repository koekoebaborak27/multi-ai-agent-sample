"use client";

import { useCallback, useState } from "react";
import type { MasterExportRequest, MasterExportStatus } from "@/modules/master/types";
import { MESSAGES } from "@/shared/constants/messages";
import { Button } from "@/shared/ui/button";

type ExportPhase = "idle" | "busy" | "timeout" | "error";

interface MasterExportButtonProps {
  /** CSVダウンロードの依頼（Server Action）。検索条件は呼び出し側で bind 済みのものを渡す */
  action: () => Promise<MasterExportRequest>;
  disabled?: boolean;
  disabledReason?: string;
}

// 状態確認の間隔と打ち切りまでの回数（§13.10.1）。2秒間隔・30回で60秒に達したら打ち切る。
const POLL_INTERVAL_MS = 2000;
const POLL_MAX_ATTEMPTS = 30;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// マスタ一覧（MST-01）・マスタ分類一覧（MST-06）に置く「CSVダウンロード」ボタン。
// 依頼 → 状態確認 → 受け取り、という3つの処理（§13.5）をボタン1つの操作としてまとめる。
export function MasterExportButton({ action, disabled, disabledReason }: MasterExportButtonProps) {
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 依頼で受け取った exportId を使い、生成が終わるまで状態を問い合わせ続ける。
  // READY になったら受け取りURLへブラウザーごと移動させ、そこでダウンロードが始まる。
  const pollStatus = useCallback(async (exportId: string) => {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      await wait(POLL_INTERVAL_MS);
      const res = await fetch(`/api/master/exports/${exportId}/status`, { cache: "no-store" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? MESSAGES.common.unexpected);
      }
      const { data } = (await res.json()) as { data: MasterExportStatus };
      if (data.status === "READY") {
        window.location.href = `/api/master/exports/${exportId}`;
        setPhase("idle");
        return;
      }
      if (data.status === "FAILED") {
        throw new Error(MESSAGES.masterExport.failed);
      }
      // QUEUED / RUNNING の間はそのまま次の問い合わせへ進む
    }
    setPhase("timeout");
  }, []);

  const handleClick = useCallback(async () => {
    setPhase("busy");
    setErrorMessage(null);
    try {
      const { exportId } = await action();
      await pollStatus(exportId);
    } catch (err) {
      setPhase("error");
      setErrorMessage(err instanceof Error ? err.message : MESSAGES.common.unexpected);
    }
  }, [action, pollStatus]);

  const busy = phase === "busy";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" disabled={disabled || busy} onClick={handleClick}>
        {busy ? "作成中..." : "CSVダウンロード"}
      </Button>
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
      {busy ? (
        <p className="text-xs text-muted-foreground">{MESSAGES.masterExport.generating}</p>
      ) : null}
      {phase === "timeout" ? (
        <p className="text-xs text-destructive">{MESSAGES.masterExport.timeout}</p>
      ) : null}
      {phase === "error" && errorMessage ? (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
