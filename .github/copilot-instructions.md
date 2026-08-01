# Copilot Instructions

本プロジェクトの基本方針・規約・落とし穴は、リポジトリの **`AGENTS.md`（正本）** に従ってください。
作業対象に応じて、近接の `src/AGENTS.md`（アーキテクチャ規約）・`prisma/AGENTS.md`（DB 規約）も参照してください。

特に重要な点（詳細は各 AGENTS.md）:

- 設計の正本は `docs/foundation_plan.md`（既存設計書と食い違う場合はこちら優先）。
- DB は Prisma 標準の命名慣習（camelCase、`@@map`/`@map` は基本使わない）。
- アーキは feature-modular。依存方向は `app → modules → shared` の一方向。サーバ専用は `server-only`。
- Next.js 16 のミドルウェアは `src/proxy.ts`。
- CI は GitHub Actions（lint/typecheck/test）、デプロイは Google Cloud Run の GitHub 連携自動デプロイ（Cloud Build トリガー）。
- UI は Shadcn/UI を使い、Button / Dialog / Input 等のプリミティブを自作しない。
- Tailwind のデザイントークン経由でスタイルする。任意値（`w-[13px]`, `text-[#abc]`）は禁止。
- クラス結合は `cn()` を使う。
- インタラクティブ要素にはアクセシビリティ属性（label / role / フォーカス可視）を付ける。
 
## Copilot 固有

- UI / デザイン規約は `DESIGN.md`、コミット / PR レビュー観点は `REVIEW.md` を参照。
- 定型作業は `.github/prompts/<name>.prompt.md` に用意しています（Copilot Chat で `/update-todo` など）。中身は `docs/skills/<name>.md` を読ませる薄い入口であり、手順の正本は `docs/skills/` 側です。
- （Copilot 固有の補足が出たらここに追記）
