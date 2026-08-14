"use client";

// 画面の一番外側の枠自体が壊れて、通常のエラー画面すら表示できないときに使われる最後の受け皿。
// 共通の部品やスタイルも読み込めない可能性があるため、
// 何にも頼らずこのファイルだけで表示できるよう、見た目の指定を直接書いている。
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "sans-serif",
        }}
      >
        <h1>致命的なエラーが発生しました</h1>
        {error.digest && <p>エラーID: {error.digest}</p>}
      </body>
    </html>
  );
}
