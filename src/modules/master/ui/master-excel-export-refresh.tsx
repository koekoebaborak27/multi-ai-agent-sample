"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Button } from "@/shared/ui/button";

const AUTO_REFRESH_INTERVAL_MS = 10_000;

interface MasterExcelExportRefreshProps {
  /** 現在表示しているページに、進行中（受付済み・作成中）の行が1件でもあるか */
  hasPending: boolean;
}

// マスタ情報Excel取得（MST-11）の実行履歴一覧を、10秒ごとに自動で最新化するボタン（設計書§40.3.4）。
// router.refresh() は今のURL（＝今のページ番号）のままServer Componentを再取得するため、
// ポーリング専用のAPIを別に作らずに実現できる。
// hasPending は毎回サーバー側で計算し直した最新値がpropsで渡ってくるため、
// 進行中の行が無くなれば useEffect の依存配列がそれを検知してタイマーを止める。
export function MasterExcelExportRefresh({ hasPending }: MasterExcelExportRefreshProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => {
      startTransition(() => router.refresh());
    }, AUTO_REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPending, router]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
    >
      {isPending ? "更新中..." : "最新の状態にする"}
    </Button>
  );
}
