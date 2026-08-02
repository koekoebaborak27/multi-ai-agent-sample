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
| 2026-08-02 | [署名 URL への差し替え方針](#署名-url-への差し替え方針) | 確定した API 仕様・インターフェース・実機確認の結果と落とし穴 |
| 2026-08-02 | [本番イメージから落としたもの](#本番イメージから落としたもの) | 実測値つきの内訳。効いた施策と効かなかった施策 |
| 2026-08-02 | [worker の起動コマンド](#worker-の起動コマンド) | 環境ごとの正しい起動方法と、`pnpm worker` が本番で使えない 2 つの理由 |
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

## 2026-08-02 署名 URL へ差し替える

### 署名 URL への差し替え方針

**2026-08-02 に実装・実機確認まで完了した**（PR #7 / `main` = `3e8487f`）。以下は実装後の確定情報であり、実測値で上書き済み。

private バケットに対して公開 URL（`/object/public/...`）が HTTP 400 で拒否されることは 2026-08-02 の疎通確認で実測済み（→ [履歴](TODO_履歴.md#2026-08-02-本番-db-の構築と-storage-の疎通確認) の 3 番目の項目）。**バケットを public にする案は、契約書類を扱う以上採らない。**

**Supabase の署名 URL API**（`@supabase/supabase-js` に依存しない REST 直叩き）:

| 項目 | 内容 |
|---|---|
| エンドポイント | `POST {SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}` |
| リクエストボディ | `{"expiresIn": <秒>}`（JSON） |
| 認証 | 既存実装と同じく `Authorization` + **`apikey` の併送**（→ [Supabase の API キー形式](#supabase-の-api-キー形式)） |
| 応答 | `{"signedURL":"/object/sign/{bucket}/{path}?token=..."}`。**`/storage/v1` を含まない相対パス**が返るため、`{SUPABASE_URL}/storage/v1` を前置して完全な URL にする |

**確定したインターフェース**（[`types.ts`](../../src/shared/storage/types.ts)）:

```ts
getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
```

| ファイル | 実際の変更 |
|---|---|
| [`types.ts`](../../src/shared/storage/types.ts) | `getPublicUrl(path): string`（同期）を上記へ置換。既定値 `DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 60` もここに置いた |
| [`supabase.ts`](../../src/shared/storage/supabase.ts) | `/object/sign/` を叩き、応答の相対パスに `{SUPABASE_URL}/storage/v1` を前置して返す。失敗時は `AppError("STORAGE_SIGNED_URL_FAILED", 502)` |
| [`local.ts`](../../src/shared/storage/local.ts) | 従来どおり `/uploads/{path}` を返す（`async` 化のみ。第 2 引数は無視される） |
| [`supabase.test.ts`](../../src/shared/storage/supabase.test.ts) | `getPublicUrl` のテストを `getSignedUrl` の 8 件へ差し替え（テスト総数 19 → 26） |

**有効期限は短くする。** 署名 URL は「発行したら URL を知る誰でも開ける」ため、画面表示のたびに発行し直す前提で既定 60 秒にした。長くすると、リンクが共有・ログ記録された場合の露出時間がそのまま延びる。

**実機確認の手順**（本番バケットに対して 2026-08-02 に実施）。[Supabase の API キー形式](#supabase-の-api-キー形式) にある tsx 直接実行と同じ要領で、使い捨てスクリプトを `uploads/`（`.gitignore` 済み）に置いて実行し、確認後に削除する。

```powershell
pnpm exec tsx --conditions=react-server --env-file=.env uploads/<スクリプト>.ts
```

スクリプトは `supabaseStorage` を直接 import すれば `STORAGE_TYPE` の切り替えは不要。確認した 4 点と実測結果:

| # | 確認内容 | 実測 |
|---|---|---|
| 1 | `upload` | 成功 |
| 2 | 発行した署名 URL を**認証ヘッダなしで** `fetch` | **200・内容一致**（ブラウザで開くのと同条件） |
| 3 | `expiresIn: 1` で発行 → 3 秒後に取得 | **400** `{"error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}` |
| 4 | 同じパスの公開 URL（署名なし） | **400** `{"error":"Bucket not found","code":"NoSuchBucket"}`（private のままであることの再確認） |

**判明した落とし穴**: **存在しないオブジェクトに対する署名 URL 発行は HTTP 400 で失敗する**（削除済みのパスを渡して確認）。実装は `AppError("STORAGE_SIGNED_URL_FAILED", 502)` を投げるため、**画面側で「ファイルが無い」と「Supabase 側の障害」を区別したい場合は、呼び出す前に存在確認するか code の細分化が要る**。既存の `download` も 404 相当を 502 として扱っており、挙動としては一貫している。

**呼び出し元がゼロのうちに変えられた。** ファイル配信画面を作った後にインターフェースを変えると呼び出し元すべてを追うことになるため、Cloud Run より前に置いた（→ [作業の順序](TODO.md#作業の順序)）。実際、変更は `src/shared/storage/` の 4 ファイルと `README.md` だけで閉じた。

## 2026-08-02 イメージを軽量化する

### 本番イメージから落としたもの

**2026-08-02 に実施・実測まで完了した**（PR #8 / `010e421`）。以下は実測値であり、着手前の見積もりは実測で上書き済み。

**結果: 1.73GB → 1.31GB（-24%）。** `node_modules` は 992MB → 約 680MB。

| 施策 | 削減 | 内容 |
|---|---|---|
| `pnpm prune --prod` | -146MB | typescript / eslint / vitest / prettier / prisma CLI 等の devDependencies |
| **musl バイナリの削除** | **-約270MB** | `@next/swc-linux-x64-musl`（125MB）/ `@rolldown/binding-linux-x64-musl` / `@img/sharp-libvips-linuxmusl-x64` |
| `.next/cache` の削除 | -340KB | **ほぼ効果なし**（下記） |

**効かなかった施策**: `.next/cache` はローカルの作業ツリーでは 403MB あるが、これは**開発サーバのキャッシュを含む値**。Docker ビルド内で生成されるのは **340KB** しかなく、本番イメージへの寄与はほぼゼロ。削除自体は無害なので残してあるが、これを狙って作業する価値はない。

**`pnpm prune --prod` は期待ほど効かない。** トップレベルのシンボリックリンクは消えるが、**`.pnpm` ストアの実体は peer 依存の参照が残るため消えない**。実際 `typescript@5.9.3`（23MB）と `prisma@6.19.3`（67MB）は `@prisma/client` から peer 参照されており、prune 後も残っている。

**musl バイナリが最大の無駄だった。** ベースイメージは `node:22-bookworm-slim`（**glibc**）なのに、pnpm は optionalDependencies として **musl 版と gnu 版の両方**を配置する。musl 版は絶対に読み込まれない。[`docker/Dockerfile`](../../docker/Dockerfile) の `build` ステージで削除している。

```dockerfile
RUN rm -rf node_modules/.pnpm/*musl*
```

`package.json` の `pnpm.supportedArchitectures` で制御する方法もあるが、**ローカル開発・CI のインストール結果まで変わる**ため採らなかった。Dockerfile 内で閉じる方式なら本番イメージにしか影響しない。

**起動コマンドを直結した。** `CMD ["pnpm", "start"]` は corepack → pnpm → next CLI と 3 段のプロセス起動を挟む。`CMD ["./node_modules/.bin/next", "start"]` に変え、あわせて `RUN corepack install`（pnpm 実体のイメージ内キャッシュ）を削除した。**この結果、本番イメージには pnpm の実体が無い** → [worker の起動コマンド](#worker-の起動コマンド)。

**判明したバグ**: **`pino-pretty` が `devDependencies` にあった。** [`logger.ts`](../../src/shared/observability/logger.ts) は `LOG_PRETTY=true` のとき transport target として**実行時に**解決するため、実体はランタイム依存。従来は本番イメージが devDependencies を丸ごと抱えていたため露見していなかったが、prune を入れると次のエラーで**全リクエストが 500 になる**。

```
⨯ Error: unable to determine transport target for "pino-pretty"
```

本番は `LOG_PRETTY=false` の想定なので普段は踏まないが、デバッグのため有効化した瞬間にアプリ全体が落ちる。`dependencies` へ移動して解消済み。

**ローカルでの検証手順**（本番イメージを起動して確認する）:

```powershell
docker compose -f docker/docker-compose.yml up -d db
docker build -f docker/Dockerfile --target runner -t contract-app:verify .
docker run -d --name app-verify -p 3100:3000 `
  -e DATABASE_URL='postgresql://app:password@host.docker.internal:5432/app_db' `
  -e AUTH_SECRET='<ローカル検証用の適当な長い文字列>' `
  -e AUTH_TRUST_HOST=true -e AUTH_URL='http://localhost:3100' `
  contract-app:verify
```

確認した 5 点と実測結果:

| # | 確認内容 | 実測 |
|---|---|---|
| 1 | `/api/health` | `{"status":"ok"}` |
| 2 | `/api/health?check=db` | `{"status":"ok","db":"up"}`（**Prisma のクエリエンジンが prune 後も残っている**） |
| 3 | `/login` と参照する CSS | ともに 200（静的アセットの漏れなし） |
| 4 | 使い捨てユーザーでの Credentials ログイン | 成功（`authjs.session-token` 発行）／誤パスワードは拒否（**`@node-rs/argon2` のネイティブバインディングが動作**） |
| 5 | 同イメージからの worker 起動 | pg-boss 待受まで到達 |

4 番目は Auth.js の Server Action ではなく **`/api/auth/csrf` → `/api/auth/callback/credentials`** を直接叩いて確認した（CSRF トークンを取ってから POST する）。使い捨てユーザーは検証後に削除すること。

**開発フローへの影響はない。** [`docker-compose.yml`](../../docker/docker-compose.yml) が使う `dev` ステージは `deps`（devDependencies 込み）から分岐しており、上記の変更は `build` / `runner` に閉じている。`docker compose up --build app worker` で従来どおり起動することを確認済み。

### worker の起動コマンド

**環境ごとに使うコマンドが違う。** 2026-08-02 の PR #8 / #9 で確定した。

| 環境 | 起動コマンド | `.env` |
|---|---|---|
| ローカル（ホスト上） | `pnpm worker` | あれば読む・無くても可 |
| ローカル（docker compose） | compose が自動起動（[`docker-compose.yml`](../../docker/docker-compose.yml) の `worker` サービス） | **不要**（接続情報は `environment:` が注入） |
| **本番コンテナ内** | **`./node_modules/.bin/tsx src/worker/index.ts`** | 無い（環境変数で渡る） |

**本番で `pnpm worker` が使えない理由は 2 つある。**

**理由1: `.env` が無い（PR #9 で解消済み）。** 変更前の `worker` スクリプトは `tsx --env-file=.env ...` で、`--env-file` は**指定ファイルが無いと Node が起動する前に落ちる**。`.env` は [`.dockerignore`](../../.dockerignore) で除外しており本番イメージに入らないため、必ず失敗していた。

```
> tsx --env-file=.env src/worker/index.ts
node: .env: not found
 ELIFECYCLE  Command failed with exit code 9.
```

`--env-file-if-exists`（「あれば読む、無ければ黙って続行」）へ変更して解消した。`worker` / `worker:prod` の 2 本に分ける案もあったが、**1 本で両対応でき使い分けを覚える必要がない**ためこちらを採った。同じ理由で [`docker-compose.yml`](../../docker/docker-compose.yml) の worker command も変更しており、**`.env` 未作成のクローン直後でも `docker compose up` が通る**ようになっている。

| 確認 | 実測 |
|---|---|
| `.env` が**無い**本番イメージで起動 | `.env not found. Continuing without it.` → pg-boss 待受まで到達 |
| `.env` が**ある**環境 | 従来どおり読む（`--env-file` と同一結果） |
| 既存の環境変数と `.env` の優先順位 | **環境変数が優先**（挙動不変） |

`--env-file-if-exists` は Node v22.23.2（本番イメージ）/ v24.15.0（ホスト）の双方で利用可能であることを確認済み。

**理由2: イメージに pnpm の実体が無い（未解消・仕様）。** PR #8 で `corepack install` を削除したため、コンテナ内で `pnpm` を叩くと **corepack がレジストリへ取りに行く**。

```
! Corepack is about to download https://registry.npmjs.org/pnpm/-/pnpm-10.15.1.tgz
```

起動のたびに外部へ取得しに行くのは遅く、ネットワーク不調なら起動そのものが失敗する。**本番コンテナ内では実行ファイルを直接叩くこと。** この注意は [`docker/Dockerfile`](../../docker/Dockerfile) の `CMD` 付近にもコメントで残してある。

## 未実施 standalone 化（積み残し）

> **この節の内容は 2026-08-02 時点で実機未確認**（着手していない）。実装時は必ず手元で確認しながら進め、判明した事実でこの節を上書きすること。
>
> **着手条件が変わった。** 2026-08-02 に standalone 化は残作業から [積み残しと検討事項](TODO.md#積み残しと検討事項) へ差し戻された。**適時は「worker 用イメージを `runner` から分離するとき」**。単独でやる価値が低い理由は [なぜ standalone 化を差し替えたか](TODO.md#なぜ-standalone-化を差し替えたか) を参照。

### standalone 化の設計上の論点

`output: "standalone"` は「**Next.js サーバの実行に必要な依存だけ**」をトレースして `.next/standalone/` に出力する機能。イメージから `node_modules` 丸ごとを追放できるが、**現行 [`Dockerfile`](../../docker/Dockerfile) の設計と正面衝突する**。

**最大の論点は worker の扱い。** `runner` ステージは「1 つのイメージでアプリ（`next start`）と worker（tsx 直接実行）の両方を動かす」設計だが、**worker は Next.js のトレース対象外なので standalone 出力には含まれない**（`src/worker/`・pg-boss・tsx がすべて落ちる）。取り得る道は 2 つ。

| 案 | 内容 | 評価 |
|---|---|---|
| A. worker を本番イメージから外す | `runner` はアプリ専用にする | 単純。[本番で動かさないもの](#本番で動かさないもの) の「本番では worker を起動しない」方針と整合する。実ジョブを追加する段階で作り直しになる |
| **B. ステージを分ける** | `runner`（standalone）と `worker-runner`（従来どおり）を併存させる | 将来に強い。Dockerfile は複雑になるが、**worker に実ジョブを載せるならどのみち必要** |

**2026-08-02 に B を前提とする方針へ変わった。** 当初は「本番で worker を動かさない」ことを根拠に A が素直としていたが、**worker に CSV アップロード / ダウンロードを載せる想定**であることが判明したため、worker 用イメージの分離は既定路線になった。**standalone 化はその分離とセットで着手する**（分離すれば app 側は worker を気にせず standalone にできる）。

**踏みやすい落とし穴**（いずれも実装時に手元で確認する）:

1. **起動コマンドが変わる。** standalone は `next start` と併用できず、`node server.js`（`.next/standalone/server.js`）で起動する。現行の `CMD ["./node_modules/.bin/next", "start"]` と [`next.config.ts`](../../next.config.ts) の既存コメントを併せて直す
2. **`public/` と `.next/static/` は自動で入らない。** standalone 出力に含まれないため、Dockerfile 側で明示的にコピーする。忘れると CSS / JS / 画像が 404 になり、**画面は表示されるがスタイルが当たらない**という分かりにくい壊れ方をする
3. **`HOSTNAME=0.0.0.0` を設定する。** 既定でループバックに束縛されると、Cloud Run のヘルスチェックがコンテナ外から到達できずデプロイが失敗する。`PORT` は Cloud Run が `8080` を注入する（→ [本番の環境変数](#本番の環境変数)）
4. **Prisma の query engine がトレースから漏れることがある。** ネイティブバイナリはトレースで拾えない場合があるため、`.prisma/client` 配下を明示コピーする必要が出る可能性がある。DB へ接続した瞬間に落ちるので、ローカル検証では**必ず DB 接続を伴う画面まで開く**こと
5. **`serverExternalPackages` の扱い。** [`next.config.ts`](../../next.config.ts#L8) で `pino` / `pg-boss` / `@node-rs/argon2` を外部化しているが、外部化したパッケージはバンドルされないぶんトレースに依存する。`@node-rs/argon2` はネイティブバインディングのため、**ログイン（パスワード照合）まで実際に通す**こと

**ローカルでの検証手順**（PR に含める。未検証の構成をいきなり本番へ出さないこと）:

コマンドは [本番イメージから落としたもの](#本番イメージから落としたもの) の「ローカルでの検証手順」と同じものが使える（`--target runner` をビルドして `docker run` する）。確認する項目は 4 つ。

| 確認 | 落とし穴との対応 |
|---|---|
| スタイルが当たった画面が出る | 2 |
| `/api/health?check=db` が `db":"up"` を返す | 4 |
| ログインできる（`/api/auth/callback/credentials` まで通す） | 4・5 |
| イメージサイズが縮んでいる（`docker images` で before/after を比較） | そもそもの目的 |

**比較の基準は 1.31GB**（2026-08-02 の軽量化後）。これを下回らなければ standalone 化の意味はない。

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
  - **将来的には CSV アップロード / ダウンロードを worker に載せる想定**（2026-08-02 に判明）。その段階で worker 用イメージを `runner` から分離し、[standalone 化](#standalone-化の設計上の論点) も併せて検討する。
  - 起動コマンドは環境ごとに違う。**本番コンテナ内では `pnpm worker` ではなく `./node_modules/.bin/tsx src/worker/index.ts`** → [worker の起動コマンド](#worker-の起動コマンド)
- **`docker/docker-compose.yml` の `db` サービス**はローカル専用。本番は Supabase を使う。
