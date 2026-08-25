# ローカル環境構築（シンプル版）

このプロジェクトを初めて自分のPCで動かす手順は [`docs/development/プロジェクトの導入手順.md`](docs/development/プロジェクトの導入手順.md) にまとめています。非エンジニアの方でも迷わないよう、用語の説明を含めて手順化してあるので、まずはこちらを参照してください。

導入済みの状態で、2回目以降にこのプロジェクトを使う（起動してログインする・作業を終える）手順は [`docs/development/プロジェクト実行手順.md`](docs/development/プロジェクト実行手順.md) を参照してください。

初期お知らせやマスタ分類などの初期データを変更する手順は、[`docs/development/初期マスタを変更したい場合.md`](docs/development/初期マスタを変更したい場合.md) を参照してください。

より詳しい機能一覧やアーキテクチャなど、プロジェクト全体については [`README.md`](README.md) を参照してください。

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

詳しい手順とうまく動かないときの対処は[`docs/development/VSCodeでデバッグする.md`](docs/development/VSCodeでデバッグする.md)を参照してください。

## 本番環境を構築する

ここまでの手順は、自分のPCで動かすためのものです。**インターネット上に公開する本番環境（インフラ）を新しく構築する**場合は、[`docs/specs/99_infra/`](docs/specs/99_infra/README.md)（インフラ構築手順書）を参照してください。

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

[`docs/development/プロジェクトの導入手順.md`のトラブルシューティング](docs/development/プロジェクトの導入手順.md#トラブルシューティング)を参照してください。
