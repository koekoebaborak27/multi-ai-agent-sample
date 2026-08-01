"use client";

import { useEffect } from "react";
import { Button } from "@/shared/ui/button";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // サーバ側で既にログ出力済み。digest は CloudWatch との突合キー。
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-muted-foreground">
        時間をおいて再度お試しください。解決しない場合は管理者へお問い合わせください。
      </p>
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          エラーID: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <Button onClick={reset}>再試行</Button>
    </main>
  );
}
