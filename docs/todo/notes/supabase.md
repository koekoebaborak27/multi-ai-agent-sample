# Supabase（プロジェクト作成・本番 DB・API キー）

Supabase のプロジェクト作成から本番 DB の初期化、API キーの形式、ローカル `.env` の扱いまで。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

> **インフラ構築の手順の正本は [`docs/specs/99_infra/`](../../specs/99_infra/README.md) に移した。**
> 新規に本番環境を構築する場合はそちらを見ること。ここに残しているのは**このプロジェクトを構築したときの実測値と経緯**（手順書に載せきれない測定値・判断の背景・当時の応答内容）である。

全分類の索引は [`README.md`](README.md)、残タスクの一覧は [`TODO.md`](../TODO.md)、作業の経緯は [`history/`](../history/README.md) を見ること。

## 目次

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-01 | [Supabase プロジェクト作成画面の設定](#supabase-プロジェクト作成画面の設定) | 作成時に選んだ値と理由（変更不可の項目あり） |
| 2026-08-01 | [Supabase 接続文字列の選び方](#supabase-接続文字列の選び方) | 3 種類のうち Session pooler 以外は使えない |
| 2026-08-01 | [Connect ダイアログの歩き方](#connect-ダイアログの歩き方) | UI が紛らわしいので歩き方を固定する |
| 2026-08-02 | [本番 DB への適用手順](#本番-db-への適用手順) | PowerShell でのマイグレーション / seed 実行 |
| 2026-08-02 | [Supabase の API キー形式](#supabase-の-api-キー形式) | 新形式キーは `apikey` ヘッダが要る |
| 2026-08-02 | [ローカルの .env に本番の値を置いてよいか](#ローカルの-env-に本番の値を置いてよいか) | 変数ごとの判断基準と切り替え方 |

## 2026-08-01 Supabase プロジェクトを作る

### Supabase プロジェクト作成画面の設定

2026-08-01 実施。

| 項目 | 設定値 | 理由 |
|---|---|---|
| GitHub (optional) | **連携しない** | Supabase 側の push 契機スキーマ自動反映は、Prisma migrate をローカルから手動実行する本プロジェクトの方針と二重管理になる |
| Database password | 生成して保管 | 接続文字列に平文で埋め込まれる。**紛失時は再生成（＝接続文字列の作り直し）が必要** |
| Region | **East US (North Virginia)** | Cloud Run の Always Free は us-central1 限定。Asia-Pacific にすると全クエリが太平洋横断になる。**作成後は変更不可** |
| Enable Data API | **オフ** | Data API は PostgREST（`/rest/v1`）による自動 REST API で、`supabase-js` を使うクライアント向け。本プロジェクトは Prisma で Postgres へ直接接続し、Storage も `/storage/v1` を直叩きするため一切使わない。オフにするとテーブルが外部公開されず攻撃面が減る |
| Automatically expose new tables | オフ | Data API をオフにすれば無関係 |
| Enable automatic RLS | オフ | Prisma は特権ユーザーで直接接続するため RLS はバイパスされる。付けても守りにならず SQL エディタ作業が煩雑になるだけ |

**Data API をオフにしても Storage は使える。** Supabase Storage は PostgREST とは別サービスで、[`src/shared/storage/supabase.ts`](../../../src/shared/storage/supabase.ts) は `SUPABASE_URL` + `SERVICE_ROLE_KEY` で `/storage/v1` を叩くだけの実装になっている。後から Settings → API で有効化することも可能。

### Supabase 接続文字列の選び方

ここを誤ると繋がらない。Supabase は 3 種類の接続文字列を出し分けており、**Session pooler 以外は使えない**。

| 種類 | ポート | Cloud Run から接続 | `prisma migrate deploy` |
|---|---|---|---|
| Direct connection | 5432 | **不可**（2024-01-15 以降 IPv6 専用。IPv4 は有料アドオン） | 可 |
| **Session pooler** | 5432 | **可** | **可** |
| Transaction pooler | 6543 | 可 | **不可**（プリペアドステートメント非対応） |

`prisma/schema.prisma` の `datasource` に `directUrl` を定義していないため、「Transaction pooler + directUrl」の構成は取れない（採用する場合はスキーマ変更が必要）。**Session pooler 1 本を `DATABASE_URL` に設定する**のが唯一の素直な選択。

### Connect ダイアログの歩き方

2026-08-01 実施。ダッシュボード上部の **Connect** から開くダイアログには 5 つのタブがあるが、**使うのは「Direct connection string」タブだけ**。

- **Framework タブ**（既定で選択されている）: `supabase-js` を使うクライアントライブラリ向け。本プロジェクトでは使わない。下部に出る黄色い警告「Database access requires the Data API」と **「Enable Data API」ボタンは押さないこと**（このタブにだけ関係する警告で、意図的にオフにしている）。Shadcn トグルも Supabase UI コンポーネント用で、本プロジェクトの shadcn/ui とは別物
- **ORM タブ**（Prisma）: 提示される設定が **Transaction pooler (6543) + `DIRECT_URL`** の構成のため、`directUrl` を持たない [`prisma/schema.prisma`](../../../prisma/schema.prisma) では**そのままコピーすると動かない**
- **Direct connection string タブ**: ここから **Session pooler** を選ぶ

Session pooler の見分け方（Transaction pooler と紛らわしい）:

- ホスト名に **`pooler`** を含む（`aws-0-us-east-1.pooler.supabase.com` 等）— Direct connection は `db.<ref>.supabase.co`
- ポートが **5432**（**6543 は Transaction pooler**。`pooler` ホストである点は共通なので、ここで見分ける）
- ユーザー名が `postgres.<プロジェクトref>` 形式 — Direct connection は単なる `postgres`

コピーした文字列には `[YOUR-PASSWORD]` というプレースホルダが入っているので、**角かっこごと**実際の DB パスワードに置換する。パスワードに `@ : / ? # [ ] %` が含まれる場合は URL エンコードが必要（`@` → `%40` 等）。Supabase の生成パスワードは英数字なので通常は不要。

## 2026-08-02 本番 DB とストレージを整える

### 本番 DB への適用手順

PowerShell で実行する。

**0. コマンド履歴にパスワードを残さない**（このセッション限りの設定）

```powershell
Set-PSReadLineOption -HistorySaveStyle SaveNothing
```

PSReadLine は既定で全コマンドを `~\AppData\Roaming\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt` に平文保存する。`$env:DATABASE_URL='...'` もそのまま残るため、本番パスワードを扱うセッションでは先に無効化する。

**1. 接続文字列を設定**（`実際のパスワード` を置換。**引用符はシングルクォート**）

```powershell
$env:DATABASE_URL='postgresql://postgres.<プロジェクトref>:実際のパスワード@aws-0-us-east-1.pooler.supabase.com:5432/postgres'
```

**2. 疎通とマイグレーション状態を確認**（非破壊。`N migrations have not yet been applied` が出れば接続 OK）

```powershell
pnpm exec prisma migrate status
```

**3. マイグレーション適用**

```powershell
pnpm exec prisma migrate deploy
```

**4. 初期 ADMIN のパスワードを設定**

```powershell
$env:SEED_ADMIN_PASSWORD='強固なパスワード'
```

**5. 初期 ADMIN を投入**

```powershell
pnpm prisma:seed
```

**6. ターミナルを閉じる**

注意点:

- **1〜5 はすべて同じターミナルで実行する。** `pnpm prisma:seed` は `tsx prisma/seed.ts` の直接実行で `.env` を読まない（[`prisma.config.ts`](../../../prisma.config.ts) の `loadEnvFile` は Prisma CLI 経由のみ有効）ため、`DATABASE_URL` が同じセッションに残っている必要がある
- **引用符はシングルクォート必須。** PowerShell のダブルクォート内は変数展開されるため、パスワードに `$` が含まれると空文字などに置換されて認証エラーになる
- **`.env` には本番の接続文字列を書かない。** `$env:` でそのセッションにのみ設定する
- **手順 6 を忘れない。** `DATABASE_URL` が本番を向いたままのターミナルで `pnpm dev` を実行すると、開発サーバが本番 DB に接続する
- `.env` の `DATABASE_URL`（localhost）に上書きされる心配はない。`process.loadEnvFile()` は既存の環境変数を優先する（[`prisma.config.ts:9-11`](../../../prisma.config.ts#L9-L11)）

### Supabase の API キー形式

2026-08-02 に判明。Supabase が現在発行する API キーは**新形式**（`sb_publishable_...` / `sb_secret_...`・40 文字程度）で、旧来の JWT 形式（`anon` / `service_role`・数百文字）とは別物。ダッシュボードの表示も Settings → **API Keys** に変わっている場合がある。

`SUPABASE_SERVICE_ROLE_KEY` に入れるのは **`secret` 側**（旧 `service_role` 相当）。`publishable`（旧 `anon`）はブラウザ露出前提の公開鍵で、private バケットには一切アクセスできない。

**新形式キーは `Authorization` だけでは認証されない。** JWT ではないため Supabase 側のパースに失敗し、全操作が次の応答で拒否される。

```
HTTP 400  {"statusCode":"403","error":"Unauthorized","message":"Invalid Compact JWS","code":"AccessDenied"}
```

`apikey` ヘッダを併送するとキーが解決される。[`src/shared/storage/supabase.ts`](../../../src/shared/storage/supabase.ts) は **PR #6 で両ヘッダを送るよう修正済み**（旧 JWT 形式でも併送で動作するため、どちらのキーでも通る）。回帰は [`src/shared/storage/supabase.test.ts`](../../../src/shared/storage/supabase.test.ts) が押さえている。

curl で直接叩いて切り分けるときも同じで、`apikey` を付けないと上の 400 になる。

```powershell
curl.exe -H "Authorization: Bearer $env:SUPABASE_SERVICE_ROLE_KEY" -H "apikey: $env:SUPABASE_SERVICE_ROLE_KEY" "$env:SUPABASE_URL/storage/v1/bucket"
```

バケット一覧が返る。`"public":false` になっていれば private で作れている。

**ストレージ実装を tsx から直接呼んで疎通確認する場合**は、次の 2 つのフラグが要る（2026-08-02 に実施した検証方法）。

```powershell
pnpm exec tsx --conditions=react-server --env-file=.env <スクリプト>
```

| フラグ | 理由 |
|---|---|
| `--conditions=react-server` | [`supabase.ts`](../../../src/shared/storage/supabase.ts) の `import "server-only"` は既定の解決だと必ず throw する。この条件を付けると空実装に解決される |
| `--env-file=.env` | [`env.ts`](../../../src/shared/config/env.ts) は `DATABASE_URL` 必須のため、スキーマ検証を通すのに要る（DB には接続しない）。**既存の環境変数が `.env` より優先される**ので、`$env:` で設定した本番の値がそのまま使われる |

検証用の使い捨てスクリプトは `uploads/`（[`.gitignore`](../../../.gitignore) 済み）に置くとコミットに混ざらない。ただし [`tsconfig.json`](../../../tsconfig.json) の `include` が `**/*.ts` のため **`pnpm typecheck` の対象にはなる**。使い終わったら削除すること。

### ローカルの .env に本番の値を置いてよいか

2026-08-02 決定。「本番の値は `.env` に書かない」は `DATABASE_URL` に限った話で、**ストレージ系は置いてよい**。判断の分かれ目は**切り替えスイッチ（安全弁）があるかどうか**。

| 変数 | `.env` に本番値 | 理由 |
|---|---|---|
| `DATABASE_URL` | **置かない** | 安全弁が無く、書いた瞬間に `pnpm dev` が本番 DB へ接続する。本番 DB を触るときだけ `$env:` でそのセッションに設定する |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **置いてよい** | `STORAGE_TYPE=local` の間は一切参照されない（[`src/shared/storage/index.ts`](../../../src/shared/storage/index.ts) の分岐が安全弁）。`.env` は [`.gitignore`](../../../.gitignore) 済み |
| `STORAGE_TYPE` | **`local` のまま** | これが安全弁そのもの |

現在の `.env`（2026-08-02 時点。実値は各自の環境にのみ存在する）:

```
STORAGE_TYPE=local
# STORAGE_TYPE=supabase                         # 本番利用の際はこちらに切り替える
SUPABASE_URL=https://<プロジェクトref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<secret キー>
SUPABASE_STORAGE_BUCKET=uploads
```

**ローカルから本番ストレージを触るときの切り替え方**は 2 通り。

| 方法 | コマンド / 操作 | 向き不向き |
|---|---|---|
| **一時的（推奨）** | `$env:STORAGE_TYPE='supabase'` | そのセッション限り。既存の環境変数が `--env-file` より優先されるため `.env` を書き換えずに済み、**戻し忘れが起きない** |
| 継続的 | `.env` のコメントを入れ替える | **戻し忘れると以降のローカル開発がすべて本番バケットを読み書きする**。作業が終わったら必ず戻す |

**Cloud Run 上の本番は `.env` を読まない。** [`.dockerignore`](../../../.dockerignore) に `.env` があるためイメージに含まれず、環境変数は Cloud Run のサービス設定から渡る（→ [本番の環境変数](cloud-run.md#本番の環境変数)）。上の切り替えはあくまで**ローカルから本番ストレージを触るため**のもので、本番デプロイとは無関係。同様に、ローカルを Docker Compose で動かす場合も `docker-compose.yml` の `environment` が `.env` より優先される。

`secret` キーが漏れた場合は、Supabase ダッシュボードで当該キーを revoke して再発行し、**`.env` と Cloud Run の両方**を更新する。

