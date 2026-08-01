"use client";

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
