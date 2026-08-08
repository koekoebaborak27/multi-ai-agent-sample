# ローカル環境構築（シンプル版）

このプロジェクトを初めて自分のPCで動かすための、最小限の手順です。

アプリ・ジョブワーカー・データベースの3つをすべてDockerで起動します。PCへNext.jsやPostgreSQLを直接インストールする必要はありません。

詳しい説明やトラブルへの対処方法は、[`README.md`](README.md)を参照してください。

## 1. 必要なソフトウェア

事前に以下をインストールしてください。

- [Git](https://git-scm.com/downloads)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) 22（LTS）
- pnpm 10.15.1

Node.jsをインストールした後、次のコマンドでpnpmを有効にします。

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

> アプリ自体はDockerの中で動くため、Node.jsとpnpmは「エディタの入力補完」と「`pnpm lint`などの検査コマンドをPC上で実行するため」に使います。

## 2. 依存パッケージをインストールする

この`README_SIMPLE.md`や`package.json`があるディレクトリで実行します。

```bash
pnpm install
```

> **依存パッケージ**とは、アプリケーションが利用するNext.jsやPrismaなどの外部ライブラリです。

## 3. 環境変数を用意する

Windows PowerShellの場合:

```powershell
Copy-Item .env.example .env
```

macOSまたはLinuxの場合:

```bash
cp .env.example .env
```

ローカルで動かすだけなら、作成した`.env`は初期値のままで構いません。

> **環境変数**とは、データベースの接続先や認証用の秘密情報など、実行環境ごとに変わる設定値です。本番用の値はこのファイルではなく、デプロイ先（Google Cloud Run）の設定画面に登録します。

## 4. すべてを起動する

Docker Desktopを起動してから実行します。

```bash
docker compose -f docker/docker-compose.yml up -d
```

このコマンドで次の3つが起動します。

| サービス | 役割 |
|---|---|
| `db` | PostgreSQL（データベース） |
| `app` | Next.jsの開発サーバ（http://localhost:3000） |
| `worker` | ジョブワーカー |

`app`は起動時に、データベースのテーブル作成（マイグレーション）まで自動で実行します。

> **ジョブワーカー**とは、画面処理とは別に、時間のかかる処理や後で実行する処理を担当するプログラムです。

初回はDockerイメージのビルドとパッケージの取得のため、数分かかります。次のコマンドで起動状況を確認できます。

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f app
```

`app`のログに`Ready`と表示されれば、起動完了です（`Ctrl+C`でログ表示を終了できます。アプリは停止しません）。

## 5. 初期データを投入する

初回のみ実行します。

```bash
docker compose -f docker/docker-compose.yml exec app pnpm prisma:seed
```

> **seed（シード）**とは、動作確認に必要な初期データを登録する処理です。

初期管理者は次の内容で作成されます。

- ログインID: `admin`
- 初期パスワード: `Admin@123`

## 6. アプリケーションを開く

ブラウザで[http://localhost:3000](http://localhost:3000)を開き、初期管理者でログインしてください。

初回ログイン後は、パスワード変更画面へ自動的に移動します。パスワードを変更するまで他の画面は利用できません。

## 7. 停止する

開発を終了するときに実行します。

```bash
docker compose -f docker/docker-compose.yml stop
```

再開するときは、手順4の`up -d`を実行します。この方法で停止しても、登録したデータは削除されません。

データベースを含めて完全に作り直したい場合のみ、次を実行します（**登録したデータはすべて削除されます**）。

```bash
docker compose -f docker/docker-compose.yml down -v
```

## よく使うコマンド

PC上で実行するコマンド（コードの検査用）:

```text
pnpm lint           # ソースコードの問題を検査
pnpm format:check   # 書式の乱れを検査
pnpm format         # 書式を自動修正
pnpm typecheck      # TypeScriptの型を検査
pnpm test           # 単体テストを実行
```

Docker上で実行するコマンド（アプリの操作用）:

```text
docker compose -f docker/docker-compose.yml logs -f app     # アプリのログを表示
docker compose -f docker/docker-compose.yml restart app     # アプリを再起動
docker compose -f docker/docker-compose.yml exec app pnpm prisma:migrate  # マイグレーション作成・適用
docker compose -f docker/docker-compose.yml exec app pnpm db:reset        # DBを初期状態に戻す
```

- **マイグレーション**: データベースのテーブルや列を、プロジェクトで定義された状態へ更新する処理です。`prisma/schema.prisma`を変更したときに実行します。

## デバッグする（VSCode）

コードを1行ずつ止めながら動かせます。`Ctrl+Shift+D`（実行とデバッグ）を開き、一覧から構成を選んで▶を押すだけで、追加の準備は不要です。

- `PC:`で始まる構成 … VSCodeがプログラムを起動します（普段はこちら）
- `Docker:`で始まる構成 … `docker compose`で起動中のコンテナへ接続します

詳しい手順とうまく動かないときの対処は[`README.md`の「VSCodeでステップイン実行する（デバッグ）」](README.md#vscodeでステップイン実行するデバッグ)を参照してください。

## 本番環境を構築する

ここまでの手順は、自分のPCで動かすためのものです。**インターネット上に公開する本番環境（インフラ）を新しく構築する**場合は、[`docs/specs/99_infra/READ_ME_INFRA.md`](docs/specs/99_infra/READ_ME_INFRA.md)（インフラ構築手順書）を参照してください。

> 本番環境は、GitHub（ソースコードの保管）・Supabase（データベースとファイル保管）・Google Cloud Run（アプリの実行）の3つを組み合わせて構築します。いずれも無料枠の範囲で動かせます。

## AIエージェントで開発する

このプロジェクトは、**GitHub Copilot・Claude Code・Codex のどれを使っても開発できる**ように準備されています。使い慣れたものを選んでください。

> **AIコーディングエージェント**とは、リポジトリの内容を読み取り、指示に応じてコードの追加・修正を行うツールです。それぞれ決められた名前のファイルを、起動時に自動で読み込みます。

| 使うツール | 自動で読み込まれるファイル |
|---|---|
| Codex | [`AGENTS.md`](AGENTS.md) |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) |
| GitHub Copilot | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) |

開発方針の内容そのものは[`AGENTS.md`](AGENTS.md)の1つにまとめてあり、他の2つはそれを読み込む入口です。**方針を書き足すときは`AGENTS.md`を編集すれば、3つのツールすべてに反映されます。**

よく行う作業は「スキル」として手順化してあり、こちらも内容は1ファイルにまとめてあります。

| スキル | 内容 | 使い方 |
|---|---|---|
| `update-todo` | 残タスク一覧（[`docs/todo/TODO.md`](docs/todo/TODO.md)）を更新し、必要に応じてREADMEも更新する | 「TODO を更新して」と伝える。Claude Code と GitHub Copilot では`/update-todo`とも入力できます |
| `push-skip-ci` | CI（自動チェック）を実行せずに変更をGitHubへ反映する。実行前に必ず確認されます | 「CIスキップでプッシュして」と伝える。Claude Code と GitHub Copilot では`/push-skip-ci`とも入力できます |

詳しくは[`README.md`の「AIエージェントによる開発」](README.md#aiエージェントによる開発マルチaiエージェント構成)を参照してください。

## うまく動かないときは

[`README.md`の「セットアップ時によくある問題」](README.md#セットアップ時によくある問題)を参照してください。
