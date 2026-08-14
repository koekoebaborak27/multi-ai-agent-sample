"use client";

import { useEffect } from "react";
import { Button } from "@/shared/ui/button";

// 画面の表示中に想定外のエラーが起きたときに、代わりに表示される画面。
// エラーの内容は利用者に見せず、問い合わせに使えるエラーIDだけを表示する。
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // エラーの詳しい内容はサーバー側ですでに記録済み。
    // ここではブラウザの開発者向け画面にも出しておき、調査しやすくする。
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-xl font-bold">エラーが発生しました</h1>
      <p className="text-sm text-muted-foreground">
        時間をおいて再度お試しください。解決しない場合は管理者へお問い合わせください。
      </p>
      {/* このIDを問い合わせ時に伝えてもらえば、サーバー側の記録から該当のエラーを探せる */}
      {error.digest && (
        <p className="text-xs text-muted-foreground">
          エラーID: <span className="font-mono">{error.digest}</span>
        </p>
      )}
      <Button onClick={reset}>再試行</Button>
    </main>
  );
}
