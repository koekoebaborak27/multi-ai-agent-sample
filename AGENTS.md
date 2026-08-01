# 汎用契約管理システムテンプレート — エージェント向け方針（正本）

**無料枠（Google Cloud Run + Supabase）で動かせる、様々な案件に流用できる汎用契約管理システムのテンプレート**。
Next.js + Prisma + PostgreSQL をベースに、認証・DB接続・観測性などの「土台」と、契約先/契約/契約条項という汎用ドメインの最小雛形を用意している。案件ごとに `src/modules/` 配下へ業務ドメインを追加していく想定。

本ファイルは Claude Code / Copilot / Codex すべてが読む**正本**。詳細は各サブディレクトリの AGENTS.md・`DESIGN.md`・`REVIEW.md` に委譲し、ここは薄く保つ。

## トップレベル構成

| ディレクトリ | 説明 |
|---|---|
| `src/` | アプリ本体（`app/` ルーティング → `modules/<機能>` 縦割り → `shared/` 横断）。規約は `@src/AGENTS.md` |
| `prisma/` | スキーマ・マイグレーション・seed。規約は `@prisma/AGENTS.md` |
| `docker/` | Dockerfile（app/worker 共用）+ docker-compose（ローカル開発用 DB） |
| `docs/` | 設計・計画ドキュメント。正本は `@docs/foundation_plan.md`。作業手順（スキル）の正本は `docs/skills/` |
| `.github/` | Copilot 指示（`copilot-instructions.md`）+ Copilot プロンプト（`prompts/`）+ CI ワークフロー（`workflows/ci.yml`） |
| `.agents/` | Codex が読むリポジトリ内スキル（`skills/<name>/SKILL.md`） |
| `.claude/` | Claude Code が読むスキル（`skills/<name>/SKILL.md`）+ 権限設定（`settings.json`） |

## ポイント

- **アーキは feature-modular**。依存方向は `app → modules → shared` の一方向のみ。サーバ専用コードは `server-only` を付ける。詳細 → `@src/AGENTS.md`
- **CI は GitHub Actions**（lint / typecheck / test）、**デプロイは Cloud Run の GitHub 連携自動デプロイ**（Cloud Build トリガー。push 契機。GitHub Actions 側に deploy ワークフローは持たない）。
- 本番 DB / ストレージは **Supabase**（PostgreSQL + Storage）。ローカルは Docker Compose の PostgreSQL + ローカルファイルシステムで代替する。
- **Next.js 16 ではミドルウェアは `src/proxy.ts`**（旧 `middleware.ts` から改名・Node ランタイム）。
- ローカル開発は `pnpm dev` の前に DB を起動: `docker compose -f docker/docker-compose.yml up -d db`
- 認証は Auth.js v5。Credentials（ID/PW）は必須、Microsoft Entra ID は環境変数が揃っている場合のみ有効化される任意プロバイダ（案件によって使う/使わないを選べる）。

## 最小規約

- ブランチ: `main` 保護 + feature ブランチ → PR。PR は**機能（モジュール）単位**で分割する。
- **例外**: `*.md` / `docs/` 配下だけの変更は CI（`paths-ignore`）が起動しないため、`main` へ直接 push してよい。コードが 1 ファイルでも混ざる場合は PR に戻す。
- CI を意図的に飛ばして push する場合（コードを含む場合も可）は `@docs/skills/push-skip-ci.md` に従う。**エージェントは実行前に必ずユーザーの承認を取り、得るまでコミットも push もしない。**
- コミット / PR のレビュー観点は `REVIEW.md`、UI / デザインは `DESIGN.md`（shadcn/ui + Tailwind v4）、テスト作成は `TESTING.md` に従う。
- コミット/PR には「何を・なぜ・どう検証したか」を記載する。
- `docs/TODO_20260722.md` と `README.md` / `README_SIMPLE.md` の更新は、`@docs/skills/update-todo.md` の手順に従う。

## 主要コマンド

```
pnpm dev            # 開発サーバ（事前に db を起動）
pnpm build          # 本番ビルド
pnpm lint           # ESLint
pnpm format:check   # Prettier チェック
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm worker         # pg-boss ワーカー（tsx 直接実行）
pnpm prisma:migrate # マイグレーション（開発）
pnpm prisma:seed    # 初期データ投入（初期 ADMIN）
```

## 参照

- 設計・確定方針: `@docs/foundation_plan.md`
- Prisma マイグレーション運用: `@docs/prisma_operations.md`
- 個人開発／無料枠運用の技術メモ: `@AI_Webアプリ開発_設計メモ.md`
- UI / デザイン規約: `DESIGN.md`
- コミット / PR レビュー観点: `REVIEW.md`
- テスト方針（単体）: `TESTING.md`
- アーキテクチャ規約: `@src/AGENTS.md`
- DB 規約: `@prisma/AGENTS.md`
- TODO / README の更新手順（スキル）: `@docs/skills/update-todo.md`
- CI をスキップして push する手順（スキル）: `@docs/skills/push-skip-ci.md`

## スキル（作業手順）

繰り返す作業の手順は `docs/skills/<name>.md` に**正本を 1 つだけ**置き、各ツールの入口はそれを読ませるだけの薄いラッパーにする（`AGENTS.md` ↔ `CLAUDE.md` ↔ `copilot-instructions.md` と同じ方式）。

| ツール | 入口 | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/<name>` または説明文による自動起動 |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | Copilot Chat で `/<name>` |
| Codex | `.agents/skills/<name>/SKILL.md` | 説明文による自動起動 |

手順を変更するときは `docs/skills/<name>.md` だけを編集する。入口ファイルに手順を複製しない。