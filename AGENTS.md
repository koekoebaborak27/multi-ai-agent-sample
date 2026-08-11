# 汎用契約管理システムテンプレート — エージェント向け方針（正本）

**無料枠（Google Cloud Run + Supabase）で動かせる、様々な案件に流用できる汎用契約管理システムのテンプレート**。
Next.js + Prisma + PostgreSQL をベースに、認証・DB接続・観測性などの「土台」と、契約先/契約/契約条項という汎用ドメインの最小雛形を用意している。案件ごとに `src/modules/` 配下へ業務ドメインを追加していく想定。

本ファイルは Claude Code / Copilot / Codex すべてが読む**正本**。詳細は各サブディレクトリの AGENTS.md・`DESIGN.md`・`REVIEW.md` に委譲し、ここは薄く保つ。

> **本文中の `@パス` は参照先を示すだけで、自動読み込みはされない**必要になった時点でエージェントが自分で開くこと。
> したがって、**開かなくても必ず守らせたいルールは、リンクに委譲せずこのファイルの本文へ直接書く**（下記「最小規約」の禁止コマンド一覧がその例）。

## トップレベル構成

| ディレクトリ | 説明 |
|---|---|
| `src/` | アプリ本体（`app/` ルーティング → `modules/<機能>` 縦割り → `shared/` 横断）。規約は `@src/AGENTS.md` |
| `prisma/` | スキーマ・マイグレーション・seed。規約は `@prisma/AGENTS.md` |
| `docker/` | Dockerfile（app/worker 共用）+ docker-compose（ローカル開発用 DB） |
| `docs/` | 設計・計画ドキュメント。正本は `@docs/foundation_plan.md`。作業手順（スキル）の正本は `docs/skills/`、開発フローは `docs/development/gitの操作ルール.md`、残タスク一式は `docs/todo/`（本編 `TODO.md` + 補足 `notes/` + 履歴 `history/`）。設計書と手順書は機能・手順ごとに分割してあり、各ディレクトリの `README.md` が索引 |
| `.github/` | Copilot 指示（`copilot-instructions.md`）+ Copilot プロンプト（`prompts/`）+ CI ワークフロー（`workflows/ci.yml`） |
| `.agents/` | Codex が読むリポジトリ内スキル（`skills/<name>/SKILL.md`） |
| `.codex/` | Codex CLI のプロジェクト設定（`config.toml`。サンドボックス / 承認ポリシー）+ 権限ルール（`rules/*.rules`） |
| `.claude/` | Claude Code が読むスキル（`skills/<name>/SKILL.md`）+ 権限設定（`settings.json`） |
| `.vscode/` | デバッグ構成・推奨拡張機能 + Copilot の権限設定（`settings.json`） |

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
- **コードにはコメントを書く。** 関数・コンポーネント・エクスポートする定数は、定義の直前に「何をするものか」を必ず書く。関数の中でも、意図が読み取りにくい分岐・条件・値には理由を添える。書き方は次の 2 点を守る。
  - **1 文目で端的に何をするかを書き、2 文目以降で詳細や「何のために」を補う。** 例: `// リクエストで渡された検索条件を使いやすく変換する。` → `// 文字列のまま渡ってくるので、数値に変換する・値が入っていない項目には初期値を入れる、等を行う。`
  - **専門用語やカタカナ語に頼らず、平易な日本語で書く。** 「フォールバック」「ファサード」「楽観ロック」等はそのまま使わず、実際の動作を説明する言葉へ置き換える（例: 「代わりに分類一覧の一番先頭を選択状態にする」）。
- **エージェントが確認なしで実行してよいコマンドと、単独で実行してはならない操作は `@docs/agent_permissions.md` が正本。** `.env` の読み取り、`pnpm db:reset` / `prisma migrate reset` / `git push --force` / `git reset --hard` は設定ファイルでも禁止しているが、強制には穴があるため**規約としても実行しない**。
- `docs/todo/TODO.md` と `README.md` / `README_SIMPLE.md` の更新は、`@docs/skills/update-todo.md` の手順に従う。
- **ドキュメントは必要な範囲だけ読む。** まずディレクトリの `README.md`（索引）か見出し検索で該当箇所を特定し、そのうえで必要な節だけを開く。20KB を超えるファイルを最初から全文読まない。読む前に `rg -n "^#{1,3} " <file>` で見出しを出せば、どこを読むべきか判断できる。
- **ドキュメントを分割・移動したら、参照元のリンクを必ず張り替える。** 移動先が 1 階層深くなる場合は本文中の相対リンク（`../`）も繰り上げる。作業後にリポジトリ全体の `.md` を走査してリンク切れが無いことを確認する。

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
- 開発フロー（ブランチ → PR → CI → マージ）: `@docs/development/gitの操作ルール.md`
- マスタ機能の基本設計（機能ごとに分割）: `@docs/specs/02_basic-design/master/README.md`
- インフラ構築手順（手順ごとに分割）: `@docs/specs/99_infra/README.md`
- Prisma マイグレーション運用: `@docs/prisma_operations.md`
- UI / デザイン規約: `DESIGN.md`
- コミット / PR レビュー観点: `REVIEW.md`
- テスト方針（単体）: `TESTING.md`
- エージェント権限ポリシー（許可 / 禁止コマンド）: `@docs/agent_permissions.md`
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