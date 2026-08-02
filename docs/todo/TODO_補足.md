# TODO 補足資料

[`TODO.md`](TODO.md) の作業項目から参照される補足事項をまとめたファイル。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

本編（`TODO.md`）は**残タスクの一覧と進捗**に専念し、詳細はこちらへ置く。

**並び順は作業の時系列**（Supabase プロジェクト作成 → 本番 DB / ストレージ → 署名 URL 化 → standalone 化 → Cloud Run）。上から順に読めば、構築を最初からなぞれる。

## 目次

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-01 | [Supabase プロジェクト作成画面の設定](#supabase-プロジェクト作成画面の設定) | 作成時に選んだ値と理由（変更不可の項目あり） |
| 2026-08-01 | [Supabase 接続文字列の選び方](#supabase-接続文字列の選び方) | 3 種類のうち Session pooler 以外は使えない |
| 2026-08-01 | [Connect ダイアログの歩き方](#connect-ダイアログの歩き方) | UI が紛らわしいので歩き方を固定する |
| 2026-08-02 | [本番 DB への適用手順](#本番-db-への適用手順) | PowerShell でのマイグレーション / seed 実行 |
| 2026-08-02 | [Supabase の API キー形式](#supabase-の-api-キー形式) | 新形式キーは `apikey` ヘッダが要る |
| 2026-08-02 | [ローカルの .env に本番の値を置いてよいか](#ローカルの-env-に本番の値を置いてよいか) | 変数ごとの判断基準と切り替え方 |
| 未実施 | [署名 URL への差し替え方針](#署名-url-への差し替え方針) | Supabase の API 仕様、影響範囲、有効期限の決め方 |
| 未実施 | [standalone 化の設計上の論点](#standalone-化の設計上の論点) | worker との衝突、5 つの落とし穴、ローカル検証手順 |
| 未実施 | [本番の環境変数](#本番の環境変数) | Cloud Run に設定する値 |
| 未実施 | [本番で動かさないもの](#本番で動かさないもの) | ワーカー / ローカル用 DB |

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

**Data API をオフにしても Storage は使える。** Supabase Storage は PostgREST とは別サービスで、[`src/shared/storage/supabase.ts`](../../src/shared/storage/supabase.ts) は `SUPABASE_URL` + `SERVICE_ROLE_KEY` で `/storage/v1` を叩くだけの実装になっている。後から Settings → API で有効化することも可能。

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
- **ORM タブ**（Prisma）: 提示される設定が **Transaction pooler (6543) + `DIRECT_URL`** の構成のため、`directUrl` を持たない [`prisma/schema.prisma`](../../prisma/schema.prisma) では**そのままコピーすると動かない**
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

- **1〜5 はすべて同じターミナルで実行する。** `pnpm prisma:seed` は `tsx prisma/seed.ts` の直接実行で `.env` を読まない（[`prisma.config.ts`](../../prisma.config.ts) の `loadEnvFile` は Prisma CLI 経由のみ有効）ため、`DATABASE_URL` が同じセッションに残っている必要がある
- **引用符はシングルクォート必須。** PowerShell のダブルクォート内は変数展開されるため、パスワードに `$` が含まれると空文字などに置換されて認証エラーになる
- **`.env` には本番の接続文字列を書かない。** `$env:` でそのセッションにのみ設定する
- **手順 6 を忘れない。** `DATABASE_URL` が本番を向いたままのターミナルで `pnpm dev` を実行すると、開発サーバが本番 DB に接続する
- `.env` の `DATABASE_URL`（localhost）に上書きされる心配はない。`process.loadEnvFile()` は既存の環境変数を優先する（[`prisma.config.ts:9-11`](../../prisma.config.ts#L9-L11)）

### Supabase の API キー形式

2026-08-02 に判明。Supabase が現在発行する API キーは**新形式**（`sb_publishable_...` / `sb_secret_...`・40 文字程度）で、旧来の JWT 形式（`anon` / `service_role`・数百文字）とは別物。ダッシュボードの表示も Settings → **API Keys** に変わっている場合がある。

`SUPABASE_SERVICE_ROLE_KEY` に入れるのは **`secret` 側**（旧 `service_role` 相当）。`publishable`（旧 `anon`）はブラウザ露出前提の公開鍵で、private バケットには一切アクセスできない。

**新形式キーは `Authorization` だけでは認証されない。** JWT ではないため Supabase 側のパースに失敗し、全操作が次の応答で拒否される。

```
HTTP 400  {"statusCode":"403","error":"Unauthorized","message":"Invalid Compact JWS","code":"AccessDenied"}
```

`apikey` ヘッダを併送するとキーが解決される。[`src/shared/storage/supabase.ts`](../../src/shared/storage/supabase.ts) は **PR #6 で両ヘッダを送るよう修正済み**（旧 JWT 形式でも併送で動作するため、どちらのキーでも通る）。回帰は [`src/shared/storage/supabase.test.ts`](../../src/shared/storage/supabase.test.ts) が押さえている。

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
| `--conditions=react-server` | [`supabase.ts`](../../src/shared/storage/supabase.ts) の `import "server-only"` は既定の解決だと必ず throw する。この条件を付けると空実装に解決される |
| `--env-file=.env` | [`env.ts`](../../src/shared/config/env.ts) は `DATABASE_URL` 必須のため、スキーマ検証を通すのに要る（DB には接続しない）。**既存の環境変数が `.env` より優先される**ので、`$env:` で設定した本番の値がそのまま使われる |

検証用の使い捨てスクリプトは `uploads/`（[`.gitignore`](../../.gitignore) 済み）に置くとコミットに混ざらない。ただし [`tsconfig.json`](../../tsconfig.json) の `include` が `**/*.ts` のため **`pnpm typecheck` の対象にはなる**。使い終わったら削除すること。

### ローカルの .env に本番の値を置いてよいか

2026-08-02 決定。「本番の値は `.env` に書かない」は `DATABASE_URL` に限った話で、**ストレージ系は置いてよい**。判断の分かれ目は**切り替えスイッチ（安全弁）があるかどうか**。

| 変数 | `.env` に本番値 | 理由 |
|---|---|---|
| `DATABASE_URL` | **置かない** | 安全弁が無く、書いた瞬間に `pnpm dev` が本番 DB へ接続する。本番 DB を触るときだけ `$env:` でそのセッションに設定する |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | **置いてよい** | `STORAGE_TYPE=local` の間は一切参照されない（[`src/shared/storage/index.ts`](../../src/shared/storage/index.ts) の分岐が安全弁）。`.env` は [`.gitignore`](../../.gitignore) 済み |
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

**Cloud Run 上の本番は `.env` を読まない。** [`.dockerignore`](../../.dockerignore) に `.env` があるためイメージに含まれず、環境変数は Cloud Run のサービス設定から渡る（→ [本番の環境変数](#本番の環境変数)）。上の切り替えはあくまで**ローカルから本番ストレージを触るため**のもので、本番デプロイとは無関係。同様に、ローカルを Docker Compose で動かす場合も `docker-compose.yml` の `environment` が `.env` より優先される。

`secret` キーが漏れた場合は、Supabase ダッシュボードで当該キーを revoke して再発行し、**`.env` と Cloud Run の両方**を更新する。

## 未実施 署名 URL 化とイメージの軽量化

> **この節の内容は 2026-08-02 時点で実機未確認**（方針を決めただけで着手していない）。実装時は必ず手元で確認しながら進め、判明した事実でこの節を上書きすること。

### 署名 URL への差し替え方針

private バケットに対して [`getPublicUrl`](../../src/shared/storage/supabase.ts#L74-L77) が返す公開 URL（`/object/public/...`）が HTTP 400 で拒否されることは、2026-08-02 の疎通確認で実測済み（→ [履歴](TODO_履歴.md#2026-08-02-本番-db-の構築と-storage-の疎通確認) の 3 番目の項目）。**バケットを public にする案は、契約書類を扱う以上採らない。**

**Supabase の署名 URL API**（`@supabase/supabase-js` に依存しない REST 直叩き）:

| 項目 | 内容 |
|---|---|
| エンドポイント | `POST {SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}` |
| リクエストボディ | `{"expiresIn": <秒>}`（JSON） |
| 認証 | 既存実装と同じく `Authorization` + **`apikey` の併送**（→ [Supabase の API キー形式](#supabase-の-api-キー形式)） |
| 応答 | `{"signedURL":"/object/sign/{bucket}/{path}?token=..."}`。**`/storage/v1` を含まない相対パス**が返るため、`{SUPABASE_URL}/storage/v1` を前置して完全な URL にする |

**先に curl 相当で叩いて応答形を確かめる**のが安全。JSON ボディを渡すため、クォートの扱いが素直な `Invoke-RestMethod` を使う（`curl.exe` は PowerShell のバージョンによって `"` のエスケープ規則が変わる）。事前に `uploads/` バケットへ何かファイルを置いておくこと。

```powershell
$headers = @{ Authorization = "Bearer $env:SUPABASE_SERVICE_ROLE_KEY"; apikey = $env:SUPABASE_SERVICE_ROLE_KEY }
$body = @{ expiresIn = 60 } | ConvertTo-Json
Invoke-RestMethod -Method Post -ContentType "application/json" -Headers $headers -Body $body `
  -Uri "$env:SUPABASE_URL/storage/v1/object/sign/uploads/<オブジェクトのパス>"
```

**影響範囲は 4 ファイルで閉じている**（2026-08-02 に `grep` で確認済み。`src/app/` と `src/modules/` からの呼び出しは**ゼロ**）。

| ファイル | 変更内容 |
|---|---|
| [`types.ts`](../../src/shared/storage/types.ts) | `getPublicUrl(path): string` → 署名 URL を返す**非同期**メソッドへ。同期のままでは API 呼び出しの結果を返せない |
| [`supabase.ts`](../../src/shared/storage/supabase.ts) | 上表のエンドポイントを叩く実装へ差し替え |
| [`local.ts`](../../src/shared/storage/local.ts) | ローカルに署名の概念はないため、従来どおり `/uploads/{path}` を返すだけ（`async` にする） |
| [`supabase.test.ts`](../../src/shared/storage/supabase.test.ts) | 既存の `getPublicUrl` のテスト（`148` 行目付近）を差し替え |

**有効期限は短くする。** 署名 URL は「発行したら URL を知る誰でも開ける」ため、画面表示のたびに発行し直す前提で数十秒〜数分に収める。長くすると、リンクが共有・ログ記録された場合の露出時間がそのまま延びる。

**呼び出し元がゼロの今がいちばん安い。** ファイル配信画面を作った後にインターフェースを変えると、呼び出し元すべてを追うことになる（この理由で Cloud Run より前に置いた → [作業の順序](TODO.md#作業の順序)）。

実装後の実機確認は、[Supabase の API キー形式](#supabase-の-api-キー形式) にある tsx 直接実行（`--conditions=react-server --env-file=.env`）と `$env:STORAGE_TYPE='supabase'` の組み合わせで行う。**発行した URL をブラウザで開いてファイルが取得できることまで**確認する（HTTP 200 を返すだけでは、期限切れ時の挙動が分からない）。

### standalone 化の設計上の論点

`output: "standalone"` は「**Next.js サーバの実行に必要な依存だけ**」をトレースして `.next/standalone/` に出力する機能。イメージから `node_modules` 丸ごとを追放できるが、**現行 [`Dockerfile`](../../docker/Dockerfile) の設計と正面衝突する**。

**最大の論点は worker の扱い。** [`runner` ステージ](../../docker/Dockerfile#L38-L62)は「1 つのイメージでアプリ（`pnpm start`）と worker（`pnpm worker` = tsx 直接実行）の両方を動かす」設計だが、**worker は Next.js のトレース対象外なので standalone 出力には含まれない**（`src/worker/`・pg-boss・tsx がすべて落ちる）。取り得る道は 2 つ。

| 案 | 内容 | 評価 |
|---|---|---|
| **A. worker を本番イメージから外す** | `runner` はアプリ専用にする | 単純。[本番で動かさないもの](#本番で動かさないもの) の「本番では worker を起動しない」方針と整合する。実ジョブを追加する段階で作り直しになる |
| B. ステージを分ける | `runner`（standalone）と `worker-runner`（従来どおり）を併存させる | 将来に強いが、Dockerfile が複雑になり、当面使わないイメージのビルド時間を払い続ける |

**現時点では A が素直**（本番で worker を動かさないことは既に決めてある）。ただし採用は着手時に再確認すること。

**踏みやすい落とし穴**（いずれも実装時に手元で確認する）:

1. **起動コマンドが変わる。** standalone は `next start` と併用できず、`node server.js`（`.next/standalone/server.js`）で起動する。`CMD ["pnpm", "start"]` と [`next.config.ts`](../../next.config.ts) の既存コメントを併せて直す
2. **`public/` と `.next/static/` は自動で入らない。** standalone 出力に含まれないため、Dockerfile 側で明示的にコピーする。忘れると CSS / JS / 画像が 404 になり、**画面は表示されるがスタイルが当たらない**という分かりにくい壊れ方をする
3. **`HOSTNAME=0.0.0.0` を設定する。** 既定でループバックに束縛されると、Cloud Run のヘルスチェックがコンテナ外から到達できずデプロイが失敗する。`PORT` は Cloud Run が `8080` を注入する（→ [本番の環境変数](#本番の環境変数)）
4. **Prisma の query engine がトレースから漏れることがある。** ネイティブバイナリはトレースで拾えない場合があるため、`.prisma/client` 配下を明示コピーする必要が出る可能性がある。DB へ接続した瞬間に落ちるので、ローカル検証では**必ず DB 接続を伴う画面まで開く**こと
5. **`serverExternalPackages` の扱い。** [`next.config.ts`](../../next.config.ts#L8) で `pino` / `pg-boss` / `@node-rs/argon2` を外部化しているが、外部化したパッケージはバンドルされないぶんトレースに依存する。`@node-rs/argon2` はネイティブバインディングのため、**ログイン（パスワード照合）まで実際に通す**こと

**ローカルでの検証手順**（この順序を選んだ前提条件。PR に含める）:

```powershell
docker build -f docker/Dockerfile --target runner -t contract-app:standalone .
docker run --rm -p 3000:3000 `
  -e DATABASE_URL='postgresql://app:password@host.docker.internal:5432/app_db' `
  -e AUTH_SECRET='<ローカル検証用の適当な長い文字列>' `
  -e AUTH_TRUST_HOST=true `
  contract-app:standalone
```

事前に `docker compose -f docker/docker-compose.yml up -d db` で DB を起動しておく。`host.docker.internal` は、コンテナから**ホスト側**（＝ポート公開された Compose の PostgreSQL）を指すための名前。上の値は [`docker-compose.yml`](../../docker/docker-compose.yml#L5-L7) の `app` / `password` / `app_db` に対応している。確認する項目は 3 つ。

| 確認 | 落とし穴との対応 |
|---|---|
| `http://localhost:3000` でスタイルが当たった画面が出る | 2 |
| ログインできる | 4・5 |
| イメージサイズが縮んでいる（`docker images` で before/after を比較） | そもそもの目的 |

## 未実施 Cloud Run 構築時に使う

### 本番の環境変数

| 変数 | 値 | 備考 |
|---|---|---|
| `DATABASE_URL` | Supabase の Session pooler 接続文字列 | → [Supabase 接続文字列の選び方](#supabase-接続文字列の選び方) |
| `AUTH_SECRET` | ランダムな長い文字列 | `openssl rand -base64 32` 等で生成 |
| `AUTH_URL` | Cloud Run が発行した URL | 初回デプロイ後に設定して再デプロイ |
| `AUTH_TRUST_HOST` | `true` | **必須**。`src/shared/config/env.ts` の既定は `false` で、リバースプロキシ背後では認証が失敗する |
| `LOG_PRETTY` | `false` | 本番は JSON 出力（Cloud Logging が構造化ログとして扱う） |
| `STORAGE_TYPE` | `supabase` | |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Supabase から取得した値 | `SERVICE_ROLE_KEY` は管理者権限の鍵。リポジトリに置かない。新形式では `secret` 側を使う（→ [Supabase の API キー形式](#supabase-の-api-キー形式)） |

`PORT` は Cloud Run が `8080` を注入し `next start` がそれを読むため、こちらで設定する必要はない（`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されない）。

### 本番で動かさないもの

- **pg-boss ワーカー**は本番では起動しない。`src/worker/index.ts` は待受のみで登録済みジョブがゼロのため、常駐させても無料枠を消費するだけになる。実ジョブを追加する段階で、Cloud Run Jobs か常駐サービスかを改めて判断する。
- **`docker/docker-compose.yml` の `db` サービス**はローカル専用。本番は Supabase を使う。
