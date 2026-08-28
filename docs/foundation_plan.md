# 汎用契約管理システムテンプレート — 開発基盤（確定方針）

> **本ドキュメントの位置づけ**: 本テンプレートの基本方針・技術選定を記録する決定ログ。設計書の前提と異なる確定事項はすべて本書が優先する。

## Context（なぜこの構成か）

もともと契約システム（参考版）の基盤として構築されたシステムを参考に
利用者がgitHubCopilot、Codex、ClaudeCodeのどのAIエージェントで製造をしても対応できる構成を検討した（マルチAIエージェント開発）。

これを「**無料枠で運用でき、様々な案件に流用できる汎用契約管理システムのテンプレート**」として作成し、認証・DB接続・観測性などの土台は可能なかぎり再現しつつ、本番構成をGoogle Cloud Run + Supabase、CI/CDをGitHub Actions + Cloud Buildにすることで、無料で利用できる構成とした。

> **2026-07-28 変更**: 当初は Railway を本番ホスティング先としていたが、Railway の無料枠が実質廃止されている（$5 のトライアルクレジットは 30 日で失効し、以後の Free plan は $1/月クレジットのみ。継続運用には Hobby $5/月が必要）ことが判明したため、Google Cloud Run へ変更した。選定の経緯は [`docs/todo/history/`](todo/history/2026-07.md#2026-07-28-ホスティング先の選定) を参照。
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
- nodemailer（メール送信。SMTP のみに対応し、特定サービスの独自 API には依存しない。§6-2 参照）
- Pino（構造化ログ）
- Vitest（単体）+ Playwright（E2E 雛形）
- lint/format: ESLint + Prettier
- Credentials 用ハッシュは `hash-wasm`（WASM版Argon2id。OS専用の追加部品は不要）

## 3. 認証・認可

`src/modules/auth/auth.ts` に Auth.js v5 を構成。**Credentials は必須、Entra ID は任意**（`src/shared/config/env.ts` の `isEntraConfigured` が環境変数の有無で判定し、未設定なら providers 配列に含めない）。

- Credentials provider: ID/PW照合 → ロック判定 → failed_attempts/locked_at 更新 → must_change_password 判定。
- Entra ID provider: OIDC。ログイン成功時 `externalId`（Entra oid）で突合。未登録ユーザは自動プロビジョン（初期ロール `VIEWER`）。
- セッションは JWT（`strategy:'jwt'`）。クレームに `userId, role, mustChangePassword, authMethod`。
- `src/proxy.ts`（Next.js 16 の middleware。Node.js ランタイム）で認証ガード・RBAC を行う。JWTクレームのみで判定し、DBアクセスはしない。
- RBACロール: `ADMIN / OPERATOR / VIEWER`（`src/shared/constants/roles.ts`）。

案件によって Entra ID を使わない場合は、`.env` に `AUTH_MICROSOFT_ENTRA_ID_*` を設定しなければ自動的にCredentialsのみの構成になる。

## 4. データベース

Prisma の標準的な命名規約に従う（テーブル名・カラム名ともに `@@map` / `@map` は使わず、モデル定義どおりの camelCase を採用）。土台として `User`（認証）・`News`（お知らせ）に加え、汎用契約管理ドメインの最小雛形（`Party` / `Contract` / `ContractItem`）を用意する。案件ごとに業務テーブルを `src/modules/<機能>/` と合わせて追加していく。

テーブル一覧・ER図・各モデルの定義は [`docs/specs/98_db/db_spec.md`](specs/98_db/db_spec.md) を参照。マイグレーション運用は [`docs/prisma_operations.md`](prisma_operations.md)、命名規約は [`prisma/AGENTS.md`](../prisma/AGENTS.md)。

## 5. コンテナ構成（ローカル開発）

`docker/docker-compose.yml`:

- `app`: Next.js（standalone 出力）。`:3000`
- `worker`: 同一イメージ、起動コマンドは `tsx src/worker/index.ts`（pg-boss 待受の雛形）
- `db`: `postgres:16`、volume 永続化、`:5432`（ローカル開発専用。本番は使わない）

本番は Cloud Run 上でアプリのみ動かし、DBはSupabaseを使うため `db` サービスは本番では起動しない。`worker` は定期バッチ処理などを実装する場合や、一時的に重い処理を動かす場合のみ本番で起動する。**なお、CSVダウンロード機能のような、利用者が画面の前で即座に完了を待つ処理を Cloud Run Jobs に載せないこと**（起動待ちが1〜3分かかるため。詳細は §6 を参照）。

## 6. 本番構成（Google Cloud Run + Supabase）

- **ホスティング**: Google Cloud Run。GitHub リポジトリを連携し、`main` ブランチへの push を契機に Cloud Build が `docker/Dockerfile` をビルドして自動デプロイする。リージョンは **us-central1**（Always Free は US リージョン限定）、最小インスタンス数 **0**（コールドスタートを受け入れて無料枠に収める）。
- **Cloud Run Jobs の起動待ち**: Cloud Run には**サービス**（リクエストを受けて応答し続ける形。最小インスタンス数で待機させられる）と**ジョブ**（1回動いて終わる形）の2種類がある。**ジョブは実行を受け付けてから実際に処理が始まるまで1〜3分待たされることがある。** これはGoogle側で実行環境を割り当てるまでの待ち時間で、イメージを小さくしても資源を増やしても縮まらない。ジョブは定期実行のバッチのように「多少待たされても困らない処理」向けの仕組みであり、**利用者が画面の前で完了を待つ処理には使わない**（その種の処理はapp側＝Cloud Runのサービスで完結させる）。実際にマスタCSVダウンロードはこの待ち時間のためworker（Cloud Run Jobs）方式をやめ、appのリクエスト内で完結する同期方式へ作り直した。実測値と比較表は [`30_CSVダウンロード.md` §30.1.9](specs/02_basic-design/master/30_CSVダウンロード.md#3019-同期方式を採用した理由) を参照。
- **DB**: Supabase PostgreSQL。**Session pooler** の接続文字列を Cloud Run の環境変数 `DATABASE_URL` に設定する。Direct connection は 2024-01-15 以降 IPv6 専用となり Cloud Run から到達できず、Transaction pooler（6543）はプリペアドステートメント非対応で `prisma migrate deploy` が通らない。`schema.prisma` に `directUrl` を持たないため、Session pooler 一本で運用する。
- **ストレージ**: Supabase Storage。ローカル開発時はファイルシステム保存で代替する（`src/shared/storage/`、環境変数 `STORAGE_TYPE` で切り替え）。
- **マイグレーション**: Cloud Run には Railway の Pre-Deploy Command に相当する仕組みがないため、当面は**ローカルから本番 DB に対して `prisma migrate deploy` を手動実行**する。自動化する場合は Cloud Run Jobs か Cloud Build のデプロイ後ステップを使う。
- **初期データ**: `prisma migrate deploy` はテーブルを作るだけで seed は実行しない。初回のみローカルから `pnpm prisma:seed` を本番 DB に対して実行する（`SEED_ADMIN_PASSWORD` を必ず指定し、既定値 `Admin@123` のまま公開しない）。
- **ポート**: Cloud Run が `PORT=8080` を注入し `next start` がそれを読む。`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されない。
- **シークレット**: `AUTH_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` 等は Cloud Run のサービス環境変数（または Secret Manager）として設定し、リポジトリにはコミットしない。
- **`AUTH_URL`**: Cloud Run の URL はデプロイ前に確定しないため、初回デプロイ後に発行された URL を設定して再デプロイする 2 段階になる。`AUTH_TRUST_HOST=true` はリバースプロキシ背後のため必須（`env.ts` の既定は `false`）。
- **無料枠の制約**: DB容量・ストレージ容量・稼働時間・スリープ等の制限があるため、利用開始時・本番公開前に各サービスの最新の無料枠条件を確認する。

## 6-2. メール送信（テンプレートは Gmail SMTP、本格流用時は Resend / Amazon SES）

> **2026-08-21 決定**: 当初はパスワード再発行のメール送信に Resend の独自 API を使う想定だったが、**Resend・Amazon SES とも「送信元として自分が管理するドメインを登録するまで他人宛に送れない」制約があり、ドメイン取得に年間費用がかかる**ことが判明した。テンプレートを完全無料で検証できる状態に保つため、次の二段構えへ変更した。経緯は [`docs/todo/history/`](todo/history/2026-08-w3.md#2026-08-21-メール送信手段をgmail-smtpへ変更し送信できる状態にした)。

- **アプリが対応するのはメール送信の共通規格である SMTP のみ**とし、特定サービスの独自の呼び出し方には対応しない。Gmail・Resend・Amazon SES はいずれも SMTP に対応しているため、**接続先の設定値（`SMTP_*`）を差し替えるだけで乗り換えられ、コードの変更が不要**になる。
- **このテンプレートの動作確認は Gmail SMTP で行う。** ドメインを持たなくても無料で他人宛に送れるため。送信専用の Google アカウントを作り、そのアプリパスワードを使う。1日あたり約500通が上限。
- **案件へ本格的に流用する段階では Resend または Amazon SES へ乗り換える。** Gmail は業務利用を想定した仕組みではなく、独自ドメインのアドレスを差出人にできないため。乗り換えに必要なのはドメインの用意・DNS への SPF / DKIM 登録・`SMTP_*` の差し替えのみ。
- 開発中は `MAIL_TRANSPORT=console` とし、実際には送らず内容をログへ出す。
- 設定手順は [`docs/specs/99_infra/` §09.1](specs/99_infra/infra_design_09_メール送信.md#091-手順8-メール送信を設定する)、設計は [`02_メール送信.md`](specs/02_basic-design/password-reset/02_メール送信.md)。

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

MAX_ATTEMPTS=20
PAGE_SIZE=30
LOG_LEVEL=info
LOG_PRETTY=true

APP_BASE_URL=http://localhost:3000   # メールに載せるURLの先頭部分。本番はCloud RunのURL
MAIL_TRANSPORT=console               # console（ログへ出すだけ）| smtp（実際に送る）
MAIL_FROM=                           # 送信元アドレス。Gmailの場合はSMTP_USERと同じ値
MAIL_FROM_NAME=契約管理システム
SMTP_HOST=smtp.gmail.com             # SESは email-smtp.<region>.amazonaws.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=                       # Gmailはアプリパスワード16文字。本番はSecret Managerの smtp-password
```

## 9. 案件ごとの拡張方法

このテンプレートを新しい案件で使う場合:

1. `Party` / `Contract` / `ContractItem` を案件のドメインに合わせてリネーム・拡張する（もしくはそのまま流用する）。
2. 案件固有の業務モジュールを `src/modules/<機能>/` に追加する（標準ファイル構成に従う）。
3. 認証で Entra ID が不要な案件は `.env` に Entra 関連の値を設定しないだけでよい（コード変更不要）。
4. Supabase / Google Cloud のプロジェクトを案件ごとに新規作成し、環境変数を差し替える。
5. メール送信を使う案件は、**Gmail SMTP から Resend または Amazon SES へ乗り換える**（§6-2）。案件のドメインを用意し、DNS へ SPF / DKIM を登録し、`SMTP_*` と `MAIL_FROM` を差し替える。コードの変更は不要。手順は [`docs/specs/99_infra/` §09.1.8](specs/99_infra/infra_design_09_メール送信.md#0918-本格運用時に-resend--amazon-ses-へ乗り換える)。

## 参照

- データベース仕様（テーブル一覧・ER図）: [`docs/specs/98_db/db_spec.md`](specs/98_db/db_spec.md)
- Prisma マイグレーション運用: [`docs/prisma_operations.md`](prisma_operations.md)
- 残タスクと進捗: [`docs/todo/TODO.md`](todo/TODO.md)
- アーキテクチャ規約: [`src/AGENTS.md`](../src/AGENTS.md)
- DB 規約: [`prisma/AGENTS.md`](../prisma/AGENTS.md)
