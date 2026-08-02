# 汎用契約管理システムテンプレート — 開発基盤（確定方針）

> **本ドキュメントの位置づけ**: 本テンプレートの基本方針・技術選定を記録する決定ログ。設計書の前提と異なる確定事項はすべて本書が優先する。

## Context（なぜこの構成か）

もともと契約システム（参考版）の基盤として構築されたシステムを参考に
利用者がgitHubCopilot、Codex、ClaudeCodeのどのAIエージェントで製造をしても対応できる構成を検討した（マルチAIエージェント開発）。

これを「**無料枠で運用でき、様々な案件に流用できる汎用契約管理システムのテンプレート**」として作成し、認証・DB接続・観測性などの土台は可能なかぎり再現しつつ、本番構成をGoogle Cloud Run + Supabase、CI/CDをGitHub Actions + Cloud Buildにすることで、無料で利用できる構成とした。

> **2026-07-28 変更**: 当初は Railway を本番ホスティング先としていたが、Railway の無料枠が実質廃止されている（$5 のトライアルクレジットは 30 日で失効し、以後の Free plan は $1/月クレジットのみ。継続運用には Hobby $5/月が必要）ことが判明したため、Google Cloud Run へ変更した。選定の経緯は [`docs/todo/TODO.md`](todo/TODO.md#ホスティング先の選定経緯) を参照。
また業務ドメインは「契約先/契約/契約条項」という汎用モデルの最小雛形にする。

## 1. アーキテクチャ方針（フィーチャーモジュラー / lite-DDD）

- `app/` は**ルーティングの薄いアダプタ**に徹し、ロジックを持たせない。
- 機能ごとに `src/modules/<機能>/` に**縦割り**で同居させる。標準ファイルは `ui/*.tsx` / `actions.ts` / `service.ts` / `repository.ts` / `validation.ts` / `types.ts` / `index.ts`。
- **依存方向**: `app/` → `modules/` → `shared/`（逆流・横流れ禁止）。`modules/A` は `modules/B/index.ts` の公開APIのみ使う。Prisma は各 module の `repository.ts` と `shared/db` 以外から触らない。
- サーバ専用コードは `server-only` を import。
- 詳細は [`src/AGENTS.md`](../src/AGENTS.md)。

## 2. 技術スタック

- Next.js 16.x（App Router）+ TypeScript(strict) + RSC、`output:'standalone'`
- pnpm、Node.js 20 LTS 以上
- Prisma（PostgreSQL。開発はDocker上のローカルPostgreSQL、本番はSupabase PostgreSQL）
- Auth.js v5（next-auth v5）— Credentials provider（必須）+ Microsoft Entra ID（任意・環境変数が揃っている場合のみ有効化）
- shadcn/ui + Tailwind CSS、React Hook Form + Zod
- 一覧表示は shadcn/ui の `<Table>` ＋ サーバ駆動のソート/ページング（TanStack Table は不採用）
- pg-boss（ジョブワーカー雛形）、papaparse + iconv-lite（CSV、将来用）
- Pino（構造化ログ）
- Vitest（単体）+ Playwright（E2E 雛形）
- lint/format: ESLint + Prettier
- Credentials 用ハッシュは `@node-rs/argon2`（Argon2id）

## 3. 認証・認可

`src/modules/auth/auth.ts` に Auth.js v5 を構成。**Credentials は必須、Entra ID は任意**（`src/shared/config/env.ts` の `isEntraConfigured` が環境変数の有無で判定し、未設定なら providers 配列に含めない）。

- Credentials provider: ID/PW照合 → ロック判定 → failed_attempts/locked_at 更新 → must_change_password 判定。
- Entra ID provider: OIDC。ログイン成功時 `externalId`（Entra oid）で突合。未登録ユーザは自動プロビジョン（初期ロール `VIEWER`）。
- セッションは JWT（`strategy:'jwt'`）。クレームに `userId, role, mustChangePassword, authMethod`。
- `src/proxy.ts`（Next.js 16 の middleware。Node.js ランタイム）で認証ガード・RBAC を行う。JWTクレームのみで判定し、DBアクセスはしない。
- RBACロール: `ADMIN / OPERATOR / VIEWER`（`src/shared/constants/roles.ts`）。

案件によって Entra ID を使わない場合は、`.env` に `AUTH_MICROSOFT_ENTRA_ID_*` を設定しなければ自動的にCredentialsのみの構成になる。

## 4. データベース

Prisma の標準的な命名規約に従う（テーブル名・カラム名ともに `@@map` / `@map` は使わず、モデル定義どおりの camelCase を採用）。

- `User`: 認証に必要な最小モデル（`id`, `role`, `passwordHash`, `failedAttempts`, `lockedAt`, `mustChangePassword`, `externalId`, `email`, `displayName` 等）。
- `Announcement`: ダッシュボード用お知らせ（任意機能）。
- 汎用契約管理ドメイン（最小雛形）:
  - `Party`（契約先）: 契約の相手方。
  - `Contract`（契約）: `Party` に紐づく契約本体。
  - `ContractItem`（契約条項/構成要素）: `Contract` に紐づく明細・金額計算対象。

案件ごとに業務テーブルを `src/modules/<機能>/` と合わせて追加していく。マイグレーション運用は [`docs/prisma_operations.md`](prisma_operations.md)、命名規約は [`prisma/AGENTS.md`](../prisma/AGENTS.md)。

## 5. コンテナ構成（ローカル開発）

`docker/docker-compose.yml`:

- `app`: Next.js（standalone 出力）。`:3000`
- `worker`: 同一イメージ、起動コマンドは `tsx src/worker/index.ts`（pg-boss 待受の雛形）
- `db`: `postgres:16`、volume 永続化、`:5432`（ローカル開発専用。本番は使わない）

本番は Cloud Run 上でアプリのみ動かし、DBはSupabaseを使うため `db` サービスは本番では起動しない。`worker` も本番では起動しない（登録済みジョブがゼロの雛形のため。実ジョブ追加時に Cloud Run Jobs か常駐サービスかを判断する）。

## 6. 本番構成（Google Cloud Run + Supabase）

- **ホスティング**: Google Cloud Run。GitHub リポジトリを連携し、`main` ブランチへの push を契機に Cloud Build が `docker/Dockerfile` をビルドして自動デプロイする。リージョンは **us-central1**（Always Free は US リージョン限定）、最小インスタンス数 **0**（コールドスタートを受け入れて無料枠に収める）。
- **DB**: Supabase PostgreSQL。**Session pooler** の接続文字列を Cloud Run の環境変数 `DATABASE_URL` に設定する。Direct connection は 2024-01-15 以降 IPv6 専用となり Cloud Run から到達できず、Transaction pooler（6543）はプリペアドステートメント非対応で `prisma migrate deploy` が通らない。`schema.prisma` に `directUrl` を持たないため、Session pooler 一本で運用する。
- **ストレージ**: Supabase Storage。ローカル開発時はファイルシステム保存で代替する（`src/shared/storage/`、環境変数 `STORAGE_TYPE` で切り替え）。
- **マイグレーション**: Cloud Run には Railway の Pre-Deploy Command に相当する仕組みがないため、当面は**ローカルから本番 DB に対して `prisma migrate deploy` を手動実行**する。自動化する場合は Cloud Run Jobs か Cloud Build のデプロイ後ステップを使う。
- **初期データ**: `prisma migrate deploy` はテーブルを作るだけで seed は実行しない。初回のみローカルから `pnpm prisma:seed` を本番 DB に対して実行する（`SEED_ADMIN_PASSWORD` を必ず指定し、既定値 `Admin@123` のまま公開しない）。
- **ポート**: Cloud Run が `PORT=8080` を注入し `next start` がそれを読む。`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されない。
- **シークレット**: `AUTH_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` 等は Cloud Run のサービス環境変数（または Secret Manager）として設定し、リポジトリにはコミットしない。
- **`AUTH_URL`**: Cloud Run の URL はデプロイ前に確定しないため、初回デプロイ後に発行された URL を設定して再デプロイする 2 段階になる。`AUTH_TRUST_HOST=true` はリバースプロキシ背後のため必須（`env.ts` の既定は `false`）。
- **無料枠の制約**: DB容量・ストレージ容量・稼働時間・スリープ等の制限があるため、利用開始時・本番公開前に各サービスの最新の無料枠条件を確認する。

## 7. CI/CD（GitHub Actions + Cloud Build）

- **GitHub Actions**（[`.github/workflows/ci.yml`](../.github/workflows/ci.yml)）: push / PR ごとに `pnpm install` → ESLint → Prettier check → `tsc --noEmit` → `prisma validate` → Vitest → `next build` を実行。PostgreSQLは `services:` で起動しマイグレーション適用まで検証する。**デプロイは行わない**（テストのみ）。
- **デプロイ**: Cloud Run の GitHub 連携（Cloud Build トリガー）による自動デプロイに任せる。GitHub Actions 側に deploy step は持たない。
- ブランチ運用は `main` 保護 + feature ブランチ → PR → CI 必須。

## 8. 環境変数（`.env.example`）

```
DATABASE_URL=postgresql://... (ローカルはDocker Postgres、本番はSupabase接続文字列)
AUTH_SECRET=...
AUTH_URL=http://localhost:3000
AUTH_TRUST_HOST=true   # 本番はCloud Run(リバースプロキシ)背後のため必須

AUTH_MICROSOFT_ENTRA_ID_ID=       # 任意。設定しない場合Entra IDは無効化される
AUTH_MICROSOFT_ENTRA_ID_SECRET=
AUTH_MICROSOFT_ENTRA_ID_ISSUER=

STORAGE_TYPE=local   # local | supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

MAX_ATTEMPTS=5
PAGE_SIZE=30
LOG_LEVEL=info
LOG_PRETTY=true
```

## 9. 案件ごとの拡張方法

このテンプレートを新しい案件で使う場合:

1. `Party` / `Contract` / `ContractItem` を案件のドメインに合わせてリネーム・拡張する（もしくはそのまま流用する）。
2. 案件固有の業務モジュールを `src/modules/<機能>/` に追加する（標準ファイル構成に従う）。
3. 認証で Entra ID が不要な案件は `.env` に Entra 関連の値を設定しないだけでよい（コード変更不要）。
4. Supabase / Google Cloud のプロジェクトを案件ごとに新規作成し、環境変数を差し替える。

## 参照

- Prisma マイグレーション運用: [`docs/prisma_operations.md`](prisma_operations.md)
- 残タスクと進捗: [`docs/todo/TODO.md`](todo/TODO.md)
- アーキテクチャ規約: [`src/AGENTS.md`](../src/AGENTS.md)
- DB 規約: [`prisma/AGENTS.md`](../prisma/AGENTS.md)