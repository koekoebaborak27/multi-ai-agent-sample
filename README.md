# 汎用契約管理システムテンプレート

**無料枠（Google Cloud Run + Supabase）で動かせる、様々な案件に流用できる契約管理システムのテンプレート。マルチAIエージェント開発にも対応。**

- アーキ: Next.js 16 App Router（feature-modular / lite-DDD）、Prisma、PostgreSQL、pg-boss（ジョブ）、shadcn/ui + Tailwind v4
- 認証 / 認可: Auth.js v5（Credentials 必須 + Microsoft Entra ID は任意）、Argon2id によるパスワードハッシュ、`src/proxy.ts` でのロールベース認可
- 入力検証 / フォーム: Zod v4 + react-hook-form / **ログ**: pino（構造化ログ） / **CSV**: papaparse
- CI: GitHub Actions（lint / format / typecheck / Prisma 検証 / test / build） / デプロイ: Google Cloud Run（GitHub 連携の自動デプロイ）
- 開発は **GitHub Copilot / Claude Code / Codex のいずれでも進められる**マルチAIエージェント構成（→ [AIエージェントによる開発](#aiエージェントによる開発マルチaiエージェント構成)）
- 設計の正本は [`docs/foundation_plan.md`](docs/foundation_plan.md)

## 主な機能

テンプレートとして、以下の画面・機能が実装済みです。案件固有の業務ドメインは `src/modules/` へ追加していきます。

| 画面 | パス | モジュール | 内容 |
|---|---|---|---|
| ログイン | `/login` | [`src/modules/auth/`](src/modules/auth/) | Credentials（ID/PW）認証。Entra ID は環境変数が揃うと追加表示 |
| パスワード再発行の申請 | `/forgot-password` | [`src/modules/password-reset/`](src/modules/password-reset/) | ログイン不要。メールアドレスを入力すると再設定用URLを送信（登録の有無は画面に出さない） |
| パスワードの再設定 | `/reset-password/{token}` | [`src/modules/password-reset/`](src/modules/password-reset/) | ログイン不要。メールのURLから新しいパスワードを設定（失敗回数・アカウントロックも解除。URLは1度使うと無効化） |
| ダッシュボード | `/` | [`src/modules/news/`](src/modules/news/) | 最新のお知らせ一覧 |
| お知らせ管理 | `/news` | [`src/modules/news/`](src/modules/news/) | **ADMIN・OPERATOR限定**。カテゴリ・タイトル・本文による検索、列見出しによるソート、URLクエリ、ページング。登録・更新・削除は実装中 |
| 契約検索一覧 | `/contracts` | [`src/modules/contract/`](src/modules/contract/) | 契約先（コンボボックスで名称検索）・状態・分類による検索、列見出しによるソート、URLクエリ、ページング、新規登録（`/contracts/new`）と確認、詳細（`/contracts/{id}`）、更新（`/contracts/{id}/edit`）と確認（楽観ロック）、削除確認ダイアログ |
| 契約先検索一覧 | `/parties` | [`src/modules/party/`](src/modules/party/) | 名称・分類による検索、列見出しによるソート、URLクエリ、ページング、新規登録（`/parties/new`）と確認、詳細（`/parties/{id}`）、更新（`/parties/{id}/edit`）と確認（楽観ロック）、削除確認ダイアログ（紐づく契約が残っている場合は削除不可） |
| ユーザー管理 | `/admin/users` | [`src/modules/user/`](src/modules/user/) | ユーザーの一覧・登録・編集・削除（**ADMIN 限定**） |
| パスワード変更 | `/settings/password` | [`src/modules/auth/`](src/modules/auth/) | 初回ログイン時は変更するまで他画面へ進めない |
| メールアドレス変更の申し込み | `/settings/email` | [`src/modules/password-reset/`](src/modules/password-reset/) | 現在のアドレスと同じ・他人が使用中のアドレスは拒否。新しいアドレス宛に確認用URLを送信 |
| メールアドレス変更の確認 | `/settings/email/confirm/{token}` | [`src/modules/password-reset/`](src/modules/password-reset/) | ログイン必須。開いた時点で変更を確定し、変更前のアドレス宛にお知らせメールを送信 |
| マスタ検索一覧 | `/master` | [`src/modules/master/`](src/modules/master/) | 先頭分類を初期選択（「すべて」へ切替可）、分類・コード・内容による検索、検索条件の開閉、列見出しによるソート、URLクエリ、ページング、新規登録（`/master/new`）と確認、詳細（`/master/{id}`）、更新（`/master/{id}/edit`）と確認、削除確認ダイアログ |
| マスタ分類管理 | `/master/categories` | [`src/modules/master/`](src/modules/master/) | 分類コード（利用者が入力・変更可能）の順で一覧表示・ページング、新規登録・確認・詳細・更新・削除確認ダイアログ（配下にマスタが残っている場合は削除不可） |

加えて、横断機能として認証セッション（`src/shared/auth/`）、DB 接続（`src/shared/db/`）、ジョブキュー（`src/shared/jobs/` + `src/worker/`）、ファイルストレージ抽象（`src/shared/storage/`）、構造化ログ（`src/shared/observability/`）、UI コンポーネント（`src/shared/ui/`）を用意しています。

## はじめてローカル環境を構築する

初めてこのプロジェクトを動かす手順は [`docs/development/プロジェクトの導入手順.md`](docs/development/プロジェクトの導入手順.md) にまとめています。非エンジニアの方でも迷わないよう、用語の説明を含めて手順化してあります。より短い案内は [`README_SIMPLE.md`](README_SIMPLE.md) を参照してください。

導入済みの状態で、2回目以降にこのプロジェクトを使う（起動してログインする・作業を終える）手順は [`docs/development/プロジェクト実行手順.md`](docs/development/プロジェクト実行手順.md) を参照してください。

初期お知らせやマスタ分類などの初期データを変更する手順は、[`docs/development/初期マスタを変更したい場合.md`](docs/development/初期マスタを変更したい場合.md) を参照してください。

> **参考：起動する3つの箱**
>
> | サービス | 役割 | 起動時の処理 |
> |---|---|---|
> | `db` | PostgreSQL 16 | データは`db-data`ボリュームに永続化 |
> | `app` | Next.js 開発サーバ（http://localhost:3000） | `prisma generate` → `prisma migrate deploy` → `next dev` |
> | `worker` | pg-boss ジョブワーカー | `prisma generate` → `tsx watch` でソース変更時に自動再起動 |
>
> `app`はマイグレーションを自動で適用するため、手動でのマイグレーション実行は不要です。ソースコードはバインドマウントされており、PC側で編集するとそのままコンテナへ反映されます。

Docker を使わずホスト上で直接動かす方法は [`docs/development/Dockerではなくパソコン上で直接動かす.md`](docs/development/Dockerではなくパソコン上で直接動かす.md)、登録したデータをGUIで確認する方法は [`docs/development/A5M2でデータベースへ接続する.md`](docs/development/A5M2でデータベースへ接続する.md) を参照してください。セットアップでよくある問題は[導入手順書のトラブルシューティング](docs/development/プロジェクトの導入手順.md#トラブルシューティング)にまとめています。

## VSCodeでデバッグする

コードを1行ずつ止めながら実行し、そのときの変数の中身を確認できます。デバッグ構成は用意済みです。詳しい手順は [`docs/development/VSCodeでデバッグする.md`](docs/development/VSCodeでデバッグする.md) を参照してください。

## 認証と権限（RBAC）

- 認証は Auth.js v5。**Credentials（ID/PW）が必須**、Microsoft Entra ID は `AUTH_MICROSOFT_ENTRA_ID_*` が3つとも設定されている場合のみ有効化される任意プロバイダです。
- パスワードは、OS専用の追加部品を必要としないWASM版のArgon2id（`hash-wasm`）でハッシュ化します。ログイン失敗が`MAX_ATTEMPTS`回（既定 **20 回**）に達したアカウントはロックされます。**ロックは自動解除されません**（`lockedAt`が立ったままになります）。解除するには管理画面から操作するか、DBの`users`テーブルで`lockedAt`を`null`・`failedAttempts`を`0`に戻してください。
- 認証ガードと認可は [`src/proxy.ts`](src/proxy.ts) が担当します（Next.js 16 で `middleware.ts` から改名。Node.js ランタイムで動作）。ロール判定は JWT クレームのみで完結し、DB アクセスは行いません。判定そのものは [`src/modules/auth/route-guard.ts`](src/modules/auth/route-guard.ts) の純粋関数`decideRedirect`にあります。
- **middlewareからServer ActionのPOSTをリダイレクトしてはいけません。** リダイレクトするとPOSTが転送先へ再送され、誘導先との間で往復し続けます（実際にログイン直後の無限ループを起こしました）。ログイン済みユーザーの誘導は画面遷移（GET）でのみ行い、未ログイン時のガードと`/admin/*`の認可はメソッドを問わず適用します。
- ロールは `ADMIN` / `OPERATOR` / `VIEWER` の3種類（[`src/shared/constants/roles.ts`](src/shared/constants/roles.ts)）。`VIEWER`は閲覧のみ、`/admin/*`は`ADMIN`限定です。

## ファイルストレージ

`STORAGE_TYPE`で保存先を切り替えます（[`src/shared/storage/`](src/shared/storage/)）。

| 値 | 保存先 | 用途 |
|---|---|---|
| `local`（既定） | `STORAGE_LOCAL_DIR`（既定`./uploads`） | ローカル開発・検証 |
| `supabase` | Supabase Storage（`SUPABASE_STORAGE_BUCKET`） | 本番 |

呼び出し側は`storage`クライアント経由で操作するため、切り替えによるアプリケーションコードの変更は不要です。

### ブラウザへファイルを渡すURL（`getSignedUrl`）

本番のSupabaseバケットは非公開（private）で運用するため、公開URLではファイルを取得できません（HTTP 400で拒否されます）。ブラウザから直接ファイルを開かせたい場合は`getSignedUrl`を使ってください。

```ts
import { storage } from "@/shared/storage";

const url = await storage.getSignedUrl("contracts/2026/a.pdf"); // 既定60秒で失効
const longer = await storage.getSignedUrl("contracts/2026/a.pdf", 300); // 秒数を指定
```

| 保存先 | 返すURL | 有効期限 |
|---|---|---|
| `supabase` | Supabaseが発行する署名URL（`?token=...`付き） | 既定60秒（第2引数で変更可） |
| `local` | `/uploads/<path>` | なし（署名の概念がないため引数は無視されます） |

> **有効期限は短く保ってください。** 署名URLは「URLを知っていれば誰でも開ける」ため、画面を表示するたびに発行し直す前提で数十秒〜数分に収めます。長くすると、リンクが共有されたりログに残ったりした場合の露出時間がそのまま延びます。

## よく使うコマンド

```text
pnpm dev            # 開発サーバ（ホストで直接動かす場合。事前に db を起動）
pnpm build          # 本番ビルド
pnpm start          # ビルド済みアプリの起動
pnpm worker         # pg-boss ワーカー
pnpm lint           # ESLint
pnpm format         # Prettier で整形
pnpm format:check   # Prettier チェック
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm test:watch     # Vitest（監視モード）
pnpm prisma:generate # Prisma Client 生成
pnpm prisma:migrate # マイグレーション作成・適用（開発）
pnpm prisma:seed    # 初期データ投入
pnpm db:reset       # DB を初期状態に戻して再構築
```

Docker で起動している場合は、`docker compose -f docker/docker-compose.yml exec app <コマンド>` の形で実行します。

- **lint（リント）**: ソースコードを静的に調べ、書き方の問題や不具合につながりやすい箇所を検出します。
- **フォーマット**: インデントや改行など、ソースコードの見た目を統一します。
- **型チェック**: TypeScriptの型定義と実際の値の使い方に矛盾がないか検査します。
- **単体テスト**: 関数やクラスなどの小さな単位が、想定どおりに動作するか自動確認します。
- **本番ビルド**: 開発用のソースコードを、本番環境で実行できる形式へ変換・最適化します。

## E2Eテスト（Playwright）

ブラウザを実際に操作して画面の動作を確認する自動テストです。手順は [`docs/development/E2Eテスト.md`](docs/development/E2Eテスト.md) を参照してください。

## CI（GitHub Actions）

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) が、`main`への push と Pull Request で単一の`verify`ジョブを実行します。ただし変更が`**.md`と`docs/**`だけの場合は`paths-ignore`により起動しません。

1. `pnpm lint`（ESLint）
2. `pnpm format:check`（Prettier）
3. `prisma validate`（スキーマ検証）
4. `prisma generate`（Prisma Client 生成）
5. `pnpm typecheck`（tsc）
6. `prisma migrate deploy`（**0からスキーマを再現できることの検証**）
7. `pnpm test`（Vitest）
8. `pnpm build`（本番ビルド）

PostgreSQL 16 をサービスコンテナとして起動し、実際にマイグレーションを適用して検証します。デプロイ自体は Cloud Build に任せるため、GitHub Actions からは行いません。

ドキュメントだけを変更した場合など、この検証が不要なときの進め方は [`docs/development/gitの操作ルール.md`](docs/development/gitの操作ルール.md#ドキュメントだけの変更でciを実行しないmainへ直接push) を参照してください。

> **`prisma generate` が `typecheck` より前にある理由**: Prisma Client（`@prisma/client` の型）は`prisma/schema.prisma`から生成されるコードであり、`node_modules`配下に作られるため Git では管理していません。生成前に`tsc`を走らせると`Module '"@prisma/client"' has no exported member 'Party'`のように型が見つからず失敗します。ローカルで同じエラーが出たときも`pnpm prisma:generate`で解決します。

## 本番デプロイ（Google Cloud Run + Supabase）

> **本番環境をゼロから構築する場合は [`docs/specs/99_infra/`](docs/specs/99_infra/README.md)（インフラ構築手順書）を参照してください。** アカウント作成から動作確認まで、画面操作と用語の説明を含めて手順化してあります。以下はその要約です。

- **本番DB / ストレージ**: [Supabase](https://supabase.com/) の PostgreSQL + Storage を使用。`STORAGE_TYPE=supabase`に切り替える。接続文字列は **Session pooler** のものを使う（Direct connection は IPv6 専用で Cloud Run から到達できず、Transaction pooler は `prisma migrate deploy` が通らない）。
- **ホスティング**: [Google Cloud Run](https://cloud.google.com/run) に GitHub リポジトリを連携し、`main` ブランチへの push を契機に Cloud Build が [`docker/Dockerfile`](docker/Dockerfile) をビルドして自動デプロイする。リージョンは Always Free 対象の **us-central1**、最小インスタンス数は **0**、**最大インスタンス数は 2**（既定の 100 のままだと想定外のアクセスで無料枠を超えるため必ず絞る）。メモリは既定の **512MiB** で足りる（実測 77MB）。
- **サービス構成**: [`docker/Dockerfile`](docker/Dockerfile) は共通の土台（`runner-base`）から `runner`（Web = `next start`）と `worker`（Cloud Run Jobs 用。`ENTRYPOINT` で `tsx src/worker/index.ts` を起動）にステージが分かれている。本番で常時稼働する Cloud Run サービスは `runner` のみ。`worker` 用のイメージはバッチ処理など時間がかかって良い処理が動くときだけ稼働する。
- **Cloud Run Jobs は起動待ちが長い**: Cloud Runの「ジョブ」は、実行を受け付けてから実際に処理が始まるまで**1〜3分かかることがあります**（Google側で実行環境を割り当てるまでの待ち時間で、イメージを小さくしても縮みません）。定期バッチのように待たされても困らない処理のための仕組みなので、**利用者が画面の前で完了を待つ処理には使わないでください**（リクエストに応答する処理はCloud Runの「サービス」＝app側で完結させます）。マスタCSVダウンロード機能はこの理由で Cloud Run Jobs での構築はあきらめ、Cloud Run Service による同期方式へ作り直しました。
- **本番イメージには開発用の依存が入っていません**。両ステージとも devDependencies（TypeScript・ESLint・Vitest 等）と、glibc ベースでは使われない musl 版ネイティブバイナリを除いてビルドします。**pnpm の実体も入っていない**ため`pnpm worker`は使えません。`worker`イメージは`ENTRYPOINT`が`./node_modules/.bin/tsx src/worker/index.ts`に固定されており、`docker run <image> --once`のように追加引数を渡すだけで単発モードに切り替わります。
- **ビルド設定**: リポジトリ直下に `Dockerfile` が無いため、ビルド構成で **`docker/Dockerfile`** を明示する。加えて **ビルドコンテキストをリポジトリルート（`.`）にする**こと。Cloud Build の Dockerfile モードは「Dockerfile のあるディレクトリ＝コンテキスト」として扱うため、既定のままだと `COPY package.json` が `file does not exist` で失敗する。
- **環境変数**: `.env.example` を参考に、本番用の値（Supabase の接続文字列・`AUTH_SECRET`・`LOG_PRETTY=false` 等）を Cloud Run のサービス設定へ登録する。`AUTH_TRUST_HOST=true` はリバースプロキシ背後のため必須。`AUTH_URL` は **サービス作成画面に表示されるエンドポイント URL** をそのまま設定できる（サービス名とリージョンを入力した時点で確定するため、デプロイ後に設定し直す必要はない）。**パスワードや鍵にあたる項目（`DATABASE_URL` / `AUTH_SECRET` / `SUPABASE_SERVICE_ROLE_KEY` / `SMTP_PASSWORD`）は直接値ではなく Secret Manager を経由させる**（Cloud Run は環境変数を直接値で設定すると監査ログに値がそのまま複製されるため）。メール送信機能（パスワード再発行など）を使う案件は、あわせて `MAIL_TRANSPORT=smtp` 等の設定が必要（→ [`infra_design_09_メール送信.md` §09.1.7](docs/specs/99_infra/infra_design_09_メール送信.md#0917-本番cloud-runに設定する)）。
- **マイグレーション**: Cloud Run にはデプロイ前フックがないため、**ローカルから本番 DB に対して `prisma migrate deploy` を手動実行**する。
- **初期データ**: `prisma migrate deploy` は seed を実行しないため、初回のみローカルから `pnpm prisma:seed` を本番 DB に対して実行する（`SEED_ADMIN_PASSWORD` を必ず指定する）。

> ポートは Cloud Run が `PORT=8080` を注入し `next start` がそれを読むため、設定は不要です（`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されません）。進捗と残タスクは [`docs/todo/TODO.md`](docs/todo/TODO.md)、コマンド単位の手順（接続文字列の選び方・`migrate deploy` / seed の実行・本番の環境変数一覧）は [`docs/todo/notes/`](docs/todo/notes/README.md) を参照してください。

技術選定の背景・段階的な拡張方針は [`docs/foundation_plan.md`](docs/foundation_plan.md) を参照。

## AIエージェントによる開発（マルチAIエージェント構成）

本プロジェクトは、**GitHub Copilot / Claude Code / Codex のいずれのAIコーディングエージェントでも開発できる**ように構成しています。特定のツールに依存しないため、開発者ごとに使い慣れたエージェントを選べます。

> **AIコーディングエージェント**とは、リポジトリの内容を読み取り、指示に応じてコードの追加・修正やコマンド実行を行うツールです。各ツールは、それぞれ決められた名前の指示ファイルを起動時に自動で読み込みます。

### 指示ファイルの構成

各エージェントは読み込むファイル名が異なりますが、**内容の正本は [`AGENTS.md`](AGENTS.md) の1つだけ**です。ツールごとのファイルは `AGENTS.md` を参照する薄い入口として置き、方針が二重管理にならないようにしています。

| エージェント | 自動で読み込むファイル | 役割 |
|---|---|---|
| 共通（正本） | [`AGENTS.md`](AGENTS.md) | 開発方針・規約の**正本**。全エージェントがこれに従う |
| Codex | [`AGENTS.md`](AGENTS.md) | 正本をそのまま読み込む（Codex の標準ファイル名） |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) | `AGENTS.md` を取り込み、Claude Code 固有の補足を追記 |
| GitHub Copilot | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | `AGENTS.md` を参照し、Copilot 固有の補足を追記 |

加えて、作業対象のディレクトリに応じて近接の [`src/AGENTS.md`](src/AGENTS.md)（アーキテクチャ規約）・[`prisma/AGENTS.md`](prisma/AGENTS.md)（DB 規約）も参照されます。

作業の種類ごとの規約は、正本から次のファイルへ委譲しています。

| 作業 | 参照するファイル |
|---|---|
| UI / デザイン | [`DESIGN.md`](DESIGN.md) |
| コミット / PR レビュー | [`REVIEW.md`](REVIEW.md) |
| テスト作成 | [`TESTING.md`](TESTING.md) |

### スキル（定型作業の手順）

繰り返し行う作業は「スキル」として手順化しており、**手順の正本も [`docs/skills/`](docs/skills/) の1ファイルだけ**です。各ツールの入口ファイルは、その正本を読ませるだけの薄いラッパーです。

| スキル | 内容 | 正本 |
|---|---|---|
| `update-todo` | [`docs/todo/TODO.md`](docs/todo/TODO.md) を更新し、影響があれば `README.md` / `README_SIMPLE.md` も更新する | [`docs/skills/update-todo.md`](docs/skills/update-todo.md) |
| `push-skip-ci` | CIを起動させずに変更をpushする。ドキュメントに限らずソースコードでも使えるが、**実行前に必ず確認を求める** | [`docs/skills/push-skip-ci.md`](docs/skills/push-skip-ci.md) |
| `create-unit-test-spec` | コード・設計書・DBスキーマからMarkdown形式の単体テスト仕様書を作成する | [`docs/skills/create-unit-test-spec.md`](docs/skills/create-unit-test-spec.md) |
| `playwright-evidence-test` | 単体テスト仕様書に沿ってPlaywrightで画面操作テストを行い、スクリーンショットとDB状態をエビデンスとして保存する。**DB書き込み・ファイル生成前に必ず確認を求める** | [`docs/skills/playwright-evidence-test.md`](docs/skills/playwright-evidence-test.md) |

| エージェント | 入口ファイル | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/update-todo` のように入力、または内容に応じて自動起動 |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | Copilot Chat で `/update-todo` のように入力 |
| Codex | `.agents/skills/<name>/SKILL.md` | 内容に応じて自動起動 |

スラッシュコマンドを使わず「TODO を更新して」「CIスキップでプッシュして」と伝えるだけでも、[`AGENTS.md`](AGENTS.md) からの参照を通じて同じ手順が適用されます。

### サブエージェント

試行錯誤のログを本体の会話に残したくない等、独立した会話（別スレッド）として実行する価値がある作業は、スキルとは別に「サブエージェント」としても用意しています。**正本はスキルと同じ [`docs/skills/`](docs/skills/) の1ファイル**で、二重管理を避けています。ツールによって実現度合いが異なります。

| サブエージェント | 内容 | 正本 |
|---|---|---|
| `create-vitest-test` | 指定した実装ファイルのVitest単体テストを作成し、`pnpm test` が通るまで直す。試行錯誤の過程は返さず、結果だけを要約する | [`docs/skills/create-vitest-test.md`](docs/skills/create-vitest-test.md) |

| エージェント | 入口ファイル | 起動方法 | 分離の実態 |
|---|---|---|---|
| Claude Code | `.claude/agents/<name>.md` | 自動委譲、または明示的な指定 | 独立した会話で実行し、要約のみ本体へ返る（真の分離） |
| GitHub Copilot | `.github/agents/<name>.agent.md` | Copilot Chat のエージェント切替ドロップダウンから手動選択 | 会話全体がそのエージェントに切り替わる。要約だけを返す仕組みは無い |
| Codex | `.agents/skills/<name>/SKILL.md`（既存のスキルと同じ入口） | 内容に応じて自動起動 | 同一セッション内で実行される（真の分離は未対応。Codexにプロジェクト同梱できる独立サブエージェント機構が現状無いため） |

試行錯誤の隔離によるトークン削減効果が確実に得られるのはClaude Codeのみです。Copilot / Codexは「役割ごとに指示を切り替えられる」以上の効果は期待しないでください。

### エージェントの権限（許可・禁止コマンド）

エージェントが**確認なしで実行してよいコマンド**と、**単独で実行してはならない操作**を定めています。**内容の正本は [`docs/agent_permissions.md`](docs/agent_permissions.md) の1ファイル**で、各ツールの設定ファイルはその表を機械可読な形へ写した入口です。

| 区分 | 対象 |
|---|---|
| 許可（確認なしで実行） | `pnpm install` / `lint` / `format:check` / `typecheck` / `test` / `build` / `prisma:generate`、`docker compose ... up` / `ps` / `logs`、`git status` / `diff` / `log` / `show` / `branch` |
| 禁止（単独で実行しない） | `.env` の読み取り、`pnpm db:reset`、`prisma migrate reset`、`git push --force`、`git reset --hard` |

| エージェント | 設定ファイル | 強制のされ方 |
|---|---|---|
| Claude Code | [`.claude/settings.json`](.claude/settings.json) | `permissions.allow` / `permissions.deny` でコマンド単位に強制 |
| Codex | [`.codex/rules/project.rules`](.codex/rules/project.rules) | execpolicy の `prefix_rule` でコマンド単位に強制（`allow` / `prompt` / `forbidden`）。[`.codex/config.toml`](.codex/config.toml) はサンドボックスと承認ポリシーのみ担当 |
| GitHub Copilot | [`.vscode/settings.json`](.vscode/settings.json) | `chat.tools.terminal.autoApprove` の正規表現ルール。`false` は「常に確認」であり禁止ではない |

> **設定による強制には穴があります。** フラグの位置がずれた形（`git push origin main --force`）やリダイレクトを含むコマンドは判定をすり抜けます。設定は補助であり、**禁止事項はエージェント共通の規約として守る**前提です（限界の詳細は [`docs/agent_permissions.md`](docs/agent_permissions.md) の「注意点」）。

許可・禁止を変更するときは、**まず `docs/agent_permissions.md` を直してから**上の3ファイルへ反映します。

### 方針を追加・変更するとき

- **全エージェントに共通する内容**は、`AGENTS.md`（またはサブディレクトリの `AGENTS.md`）へ書きます。
- **定型作業の手順**は、`docs/skills/<name>.md`（正本）へ書きます。入口ファイルへ手順を複製しないでください。
- **特定のエージェントにだけ必要な補足**は、そのツールのファイルの「◯◯ 固有」セクションへ書きます。
- どのエージェントを使っても、成果物は同じ規約・同じ CI（`pnpm lint` / `format:check` / `typecheck` / `test` / `build`）で検証されます。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [`README_SIMPLE.md`](README_SIMPLE.md) | ローカル環境構築の最小手順（初めての方向け） |
| [`docs/development/プロジェクトの導入手順.md`](docs/development/プロジェクトの導入手順.md) | ローカル環境構築手順の正本（非エンジニア向け・トラブルシューティング含む） |
| [`docs/development/プロジェクト実行手順.md`](docs/development/プロジェクト実行手順.md) | 導入済みの環境を2回目以降に起動・終了する手順 |
| [`docs/development/初期マスタを変更したい場合.md`](docs/development/初期マスタを変更したい場合.md) | 初期お知らせ・マスタ分類などの初期データを変更する手順 |
| [`AGENTS.md`](AGENTS.md) | 開発方針の正本（全エージェント共通 / Codex が読み込む） |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code 向けの入口（`AGENTS.md` + Claude 固有の補足） |
| [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | GitHub Copilot 向けの入口（`AGENTS.md` + Copilot 固有の補足） |
| [`docs/foundation_plan.md`](docs/foundation_plan.md) | 設計・確定方針（設計の正本） |
| [`docs/specs/99_infra/`](docs/specs/99_infra/README.md) | **インフラ構築手順書**（本番環境をゼロから構築する手順の正本） |
| [`docs/diagrams.md`](docs/diagrams.md) | 構成図・フロー図 |
| [`docs/prisma_operations.md`](docs/prisma_operations.md) | Prisma マイグレーション運用フロー |
| [`docs/development/gitの操作ルール.md`](docs/development/gitの操作ルール.md) | **開発フロー**（ブランチ → Pull Request → CI → マージ。`main` へ直接 push する例外を含む） |
| [`docs/development/本番リリース手順.md`](docs/development/本番リリース手順.md) | **本番リリース手順**（マージ後、自動デプロイとDBマイグレーション適用が本番へ届くまでの全体像） |
| [`docs/todo/TODO.md`](docs/todo/TODO.md) | 残タスク一覧・進捗・現在の状態 |
| [`docs/todo/notes/`](docs/todo/notes/README.md) | 残タスクの補足（Supabase / Cloud Run の設定値・手順・落とし穴） |
| [`docs/todo/history/`](docs/todo/history/README.md) | セッションごとの作業記録（引き継ぎメモ） |
| [`docs/skills/update-todo.md`](docs/skills/update-todo.md) | TODO / README の更新手順（スキルの正本・全エージェント共通） |
| [`docs/skills/push-skip-ci.md`](docs/skills/push-skip-ci.md) | CI をスキップして push する手順（スキルの正本・全エージェント共通） |
| [`docs/skills/create-unit-test-spec.md`](docs/skills/create-unit-test-spec.md) | 単体テスト仕様書（Markdown）の作成手順（スキルの正本・全エージェント共通） |
| [`docs/skills/playwright-evidence-test.md`](docs/skills/playwright-evidence-test.md) | Playwrightによる画面操作テストとエビデンス保存の手順（スキルの正本・全エージェント共通） |
| [`docs/agent_permissions.md`](docs/agent_permissions.md) | エージェント権限ポリシー（許可 / 禁止コマンドの正本・全エージェント共通） |
| [`src/AGENTS.md`](src/AGENTS.md) | アーキテクチャ規約（feature-modular） |
| [`prisma/AGENTS.md`](prisma/AGENTS.md) | DB 規約 |
| [`DESIGN.md`](DESIGN.md) | UI / デザイン規約（shadcn/ui + Tailwind v4） |
| [`REVIEW.md`](REVIEW.md) | コミット / PR レビュー観点 |
| [`TESTING.md`](TESTING.md) | テスト方針（単体） |
