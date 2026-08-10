# Docker イメージと worker

本番イメージの軽量化（実測値つきの内訳）、worker の起動方法、未実施の standalone 化の論点。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

> **インフラ構築の手順の正本は [`docs/specs/99_infra/`](../../specs/99_infra/README.md) に移した。**
> 新規に本番環境を構築する場合はそちらを見ること。ここに残しているのは**このプロジェクトを構築したときの実測値と経緯**（手順書に載せきれない測定値・判断の背景・当時の応答内容）である。

全分類の索引は [`README.md`](README.md)、残タスクの一覧は [`TODO.md`](../TODO.md)、作業の経緯は [`history/`](../history/README.md) を見ること。

## 目次

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-02 | [本番イメージから落としたもの](#本番イメージから落としたもの) | 実測値つきの内訳。効いた施策と効かなかった施策 |
| 2026-08-02 | [worker の起動コマンド](#worker-の起動コマンド) | 環境ごとの正しい起動方法と、`pnpm worker` が本番で使えない 2 つの理由 |
| 未実施 | [standalone 化の設計上の論点](#standalone-化の設計上の論点) | worker との衝突、5 つの落とし穴、ローカル検証手順 |

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

**musl バイナリが最大の無駄だった。** ベースイメージは `node:22-bookworm-slim`（**glibc**）なのに、pnpm は optionalDependencies として **musl 版と gnu 版の両方**を配置する。musl 版は絶対に読み込まれない。[`docker/Dockerfile`](../../../docker/Dockerfile) の `build` ステージで削除している。

```dockerfile
RUN rm -rf node_modules/.pnpm/*musl*
```

`package.json` の `pnpm.supportedArchitectures` で制御する方法もあるが、**ローカル開発・CI のインストール結果まで変わる**ため採らなかった。Dockerfile 内で閉じる方式なら本番イメージにしか影響しない。

**起動コマンドを直結した。** `CMD ["pnpm", "start"]` は corepack → pnpm → next CLI と 3 段のプロセス起動を挟む。`CMD ["./node_modules/.bin/next", "start"]` に変え、あわせて `RUN corepack install`（pnpm 実体のイメージ内キャッシュ）を削除した。**この結果、本番イメージには pnpm の実体が無い** → [worker の起動コマンド](#worker-の起動コマンド)。

**判明したバグ**: **`pino-pretty` が `devDependencies` にあった。** [`logger.ts`](../../../src/shared/observability/logger.ts) は `LOG_PRETTY=true` のとき transport target として**実行時に**解決するため、実体はランタイム依存。従来は本番イメージが devDependencies を丸ごと抱えていたため露見していなかったが、prune を入れると次のエラーで**全リクエストが 500 になる**。

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

**開発フローへの影響はない。** [`docker-compose.yml`](../../../docker/docker-compose.yml) が使う `dev` ステージは `deps`（devDependencies 込み）から分岐しており、上記の変更は `build` / `runner` に閉じている。`docker compose up --build app worker` で従来どおり起動することを確認済み。

### worker の起動コマンド

**環境ごとに使うコマンドが違う。** 2026-08-02 の PR #8 / #9 で確定した。

| 環境 | 起動コマンド | `.env` |
|---|---|---|
| ローカル（ホスト上） | `pnpm worker` | あれば読む・無くても可 |
| ローカル（docker compose） | compose が自動起動（[`docker-compose.yml`](../../../docker/docker-compose.yml) の `worker` サービス） | **不要**（接続情報は `environment:` が注入） |
| **本番コンテナ内** | **`./node_modules/.bin/tsx src/worker/index.ts`** | 無い（環境変数で渡る） |

**本番で `pnpm worker` が使えない理由は 2 つある。**

**理由1: `.env` が無い（PR #9 で解消済み）。** 変更前の `worker` スクリプトは `tsx --env-file=.env ...` で、`--env-file` は**指定ファイルが無いと Node が起動する前に落ちる**。`.env` は [`.dockerignore`](../../../.dockerignore) で除外しており本番イメージに入らないため、必ず失敗していた。

```
> tsx --env-file=.env src/worker/index.ts
node: .env: not found
 ELIFECYCLE  Command failed with exit code 9.
```

`--env-file-if-exists`（「あれば読む、無ければ黙って続行」）へ変更して解消した。`worker` / `worker:prod` の 2 本に分ける案もあったが、**1 本で両対応でき使い分けを覚える必要がない**ためこちらを採った。同じ理由で [`docker-compose.yml`](../../../docker/docker-compose.yml) の worker command も変更しており、**`.env` 未作成のクローン直後でも `docker compose up` が通る**ようになっている。

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

起動のたびに外部へ取得しに行くのは遅く、ネットワーク不調なら起動そのものが失敗する。**本番コンテナ内では実行ファイルを直接叩くこと。** この注意は [`docker/Dockerfile`](../../../docker/Dockerfile) の `CMD` 付近にもコメントで残してある。

## 未実施 standalone 化（積み残し）

> **この節の内容は 2026-08-02 時点で実機未確認**（着手していない）。実装時は必ず手元で確認しながら進め、判明した事実でこの節を上書きすること。
>
> **着手条件が変わった。** 2026-08-02 に standalone 化は残作業から [残っているタスク](../TODO.md#残っているタスク) へ差し戻された。**適時は「worker 用イメージを `runner` から分離するとき」**。単独でやる価値が低い理由は [Docker イメージの軽量化と worker の .env 依存解消](../history/2026-08-w1.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消) を参照。

### standalone 化の設計上の論点

`output: "standalone"` は「**Next.js サーバの実行に必要な依存だけ**」をトレースして `.next/standalone/` に出力する機能。イメージから `node_modules` 丸ごとを追放できるが、**現行 [`Dockerfile`](../../../docker/Dockerfile) の設計と正面衝突する**。

**最大の論点は worker の扱い。** `runner` ステージは「1 つのイメージでアプリ（`next start`）と worker（tsx 直接実行）の両方を動かす」設計だが、**worker は Next.js のトレース対象外なので standalone 出力には含まれない**（`src/worker/`・pg-boss・tsx がすべて落ちる）。取り得る道は 2 つ。

| 案 | 内容 | 評価 |
|---|---|---|
| A. worker を本番イメージから外す | `runner` はアプリ専用にする | 単純。[本番で動かさないもの](cloud-run.md#本番で動かさないもの) の「本番では worker を起動しない」方針と整合する。実ジョブを追加する段階で作り直しになる |
| **B. ステージを分ける** | `runner`（standalone）と `worker-runner`（従来どおり）を併存させる | 将来に強い。Dockerfile は複雑になるが、**worker に実ジョブを載せるならどのみち必要** |

**2026-08-02 に B を前提とする方針へ変わった。** 当初は「本番で worker を動かさない」ことを根拠に A が素直としていたが、**worker に CSV アップロード / ダウンロードを載せる想定**であることが判明したため、worker 用イメージの分離は既定路線になった。**standalone 化はその分離とセットで着手する**（分離すれば app 側は worker を気にせず standalone にできる）。

**踏みやすい落とし穴**（いずれも実装時に手元で確認する）:

1. **起動コマンドが変わる。** standalone は `next start` と併用できず、`node server.js`（`.next/standalone/server.js`）で起動する。現行の `CMD ["./node_modules/.bin/next", "start"]` と [`next.config.ts`](../../../next.config.ts) の既存コメントを併せて直す
2. **`public/` と `.next/static/` は自動で入らない。** standalone 出力に含まれないため、Dockerfile 側で明示的にコピーする。忘れると CSS / JS / 画像が 404 になり、**画面は表示されるがスタイルが当たらない**という分かりにくい壊れ方をする
3. **`HOSTNAME=0.0.0.0` を設定する。** 既定でループバックに束縛されると、Cloud Run のヘルスチェックがコンテナ外から到達できずデプロイが失敗する。`PORT` は Cloud Run が `8080` を注入する（→ [本番の環境変数](cloud-run.md#本番の環境変数)）
4. **Prisma の query engine がトレースから漏れることがある。** ネイティブバイナリはトレースで拾えない場合があるため、`.prisma/client` 配下を明示コピーする必要が出る可能性がある。DB へ接続した瞬間に落ちるので、ローカル検証では**必ず DB 接続を伴う画面まで開く**こと
5. **`serverExternalPackages` の扱い。** [`next.config.ts`](../../../next.config.ts#L8) で `pino` / `pg-boss` / `@node-rs/argon2` を外部化しているが、外部化したパッケージはバンドルされないぶんトレースに依存する。`@node-rs/argon2` はネイティブバインディングのため、**ログイン（パスワード照合）まで実際に通す**こと

**ローカルでの検証手順**（PR に含める。未検証の構成をいきなり本番へ出さないこと）:

コマンドは [本番イメージから落としたもの](#本番イメージから落としたもの) の「ローカルでの検証手順」と同じものが使える（`--target runner` をビルドして `docker run` する）。確認する項目は 4 つ。

| 確認 | 落とし穴との対応 |
|---|---|
| スタイルが当たった画面が出る | 2 |
| `/api/health?check=db` が `db":"up"` を返す | 4 |
| ログインできる（`/api/auth/callback/credentials` まで通す） | 4・5 |
| イメージサイズが縮んでいる（`docker images` で before/after を比較） | そもそもの目的 |

**比較の基準は 1.31GB**（2026-08-02 の軽量化後）。これを下回らなければ standalone 化の意味はない。

