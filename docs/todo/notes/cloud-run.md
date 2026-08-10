# Cloud Run と Cloud Build

Cloud Run のサービス作成時の設定値、Cloud Build が落ちた 2 つの原因、本番の環境変数と確認手順。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

> **インフラ構築の手順の正本は [`docs/specs/99_infra/READ_ME_INFRA.md`](../../specs/99_infra/README.md) に移した。**
> 新規に本番環境を構築する場合はそちらを見ること。ここに残しているのは**このプロジェクトを構築したときの実測値と経緯**（手順書に載せきれない測定値・判断の背景・当時の応答内容）である。

全分類の索引は [`README.md`](README.md)、残タスクの一覧は [`TODO.md`](../TODO.md)、作業の経緯は [`history/`](../history/README.md) を見ること。

## 目次

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-04 | [Cloud Run のサービス作成画面](#cloud-run-のサービス作成画面) | 画面ごとの設定値と、既定のままだと危ない項目 |
| 2026-08-04 | [Cloud Build が失敗する 2 つの原因](#cloud-build-が失敗する-2-つの原因) | 権限不足とビルドコンテキスト。**初回は 2 回連続で落ちた** |
| 2026-08-04 | [本番の環境変数](#本番の環境変数) | Cloud Run に設定する 9 個 |
| 2026-08-04 | [デプロイ後の確認](#デプロイ後の確認) | 疎通コマンドと、自動デプロイの反映を判定する方法 |
| 2026-08-04 | [本番で動かさないもの](#本番で動かさないもの) | ワーカー / ローカル用 DB |

## 2026-08-04 Cloud Run を構築する

**2026-08-04 に実施・完了した。** 以下は実測値であり、着手前の想定は実測で上書き済み。**コンソールの UI が想定と大きく違い、Cloud Build も 2 回連続で失敗した**ので、次に構築する人が同じ所で止まらないよう画面単位で残す。

### Cloud Run のサービス作成画面

**「サービスを作成」ボタンは無い。** Cloud Run を開くと概要ページが出るので、「ウェブサービスのデプロイ」の下にある **「リポジトリの接続」**（GitHub アイコンのカード）を押す。左メニューの「サービス」からなら従来どおりの一覧画面に行ける。

そこから先はサービス設定とビルド設定が**1 画面に統合**されている。設定した値は次のとおり。

| 項目 | 設定値 | 理由 |
|---|---|---|
| ソース | リポジトリから継続的にデプロイする | もう一方（既存のコンテナイメージ）を選ぶと push 契機の自動デプロイにならない |
| 接続方式 | **Developer Connect**（既定のまま） | 上の「Cloud Build」は GitHub 専用の旧経路。どちらでも動く |
| サービス の名前 | `contract-app` | **作成後に変更不可** |
| リージョン | **`us-central1`（アイオワ）** | 既定は `europe-west1` になっている。**Always Free は US リージョン限定**なので必ず変更する。**作成後に変更不可** |
| 認証 | **パブリック アクセスを許可** | 既定では未選択。「認証が必要」にすると Google アカウント認証が手前に挟まり、アプリのログイン画面に到達できない |
| 課金 | リクエスト ベース（既定） | リクエスト処理時のみ課金 |
| インスタンスの最小数 | `0`（既定） | 待機中の課金をゼロにする。代わりにコールドスタートを受け入れる |
| **インスタンスの最大数** | **`2`** | **既定は空欄（＝100）。想定外のアクセスで 100 本まで自動増加し、Always Free を突き抜けて課金される。必ず絞る** |
| Ingress | すべて（既定） | |
| コンテナ ポート | `8080`（既定のまま） | Cloud Run がこの番号を `PORT` として渡し `next start` が読む。`docker/Dockerfile` の `EXPOSE 3000` は参照されない |
| メモリ | **`512 MiB`（既定のまま）** | 実測 77MB なので 6 倍以上の余裕がある（下記）。1GiB に上げると無料枠（360,000 GiB 秒/月）の消費速度が 2 倍になる |
| サービス アカウント | `<プロジェクト番号>-compute@developer.gserviceaccount.com` | 「セキュリティ」タブで**明示的な選択が必須**。未選択のまま「作成」を押すとエラーで進めない |

**メモリは実測してから決めた。** ローカルで本番イメージを起動し、`/api/health?check=db` と `/login` を通した状態で計測した値。

```powershell
docker run -d --name app-verify -p 3100:3000 -e DATABASE_URL='...' ... contract-app:verify
docker stats app-verify --no-stream --format "MEM: {{.MemUsage}} ({{.MemPerc}})"
# → MEM: 77.07MiB / 7.621GiB  (0.99%)
```

**エンドポイント URL は作成前に画面へ表示される。** サービス名とリージョンを入力した時点で `https://contract-app-<プロジェクト番号>.us-central1.run.app` が確定するため、**`AUTH_URL` を最初から設定でき、2 段階デプロイは不要**だった（[`AUTH_URL` は optional](../../../src/shared/config/env.ts) なので未設定でも起動はする）。古い資料にある `https://<service>-<hash>-uc.a.run.app` 形式ではない。

**サービス アカウントは既定を選んだ。** このアプリは Google Cloud の API を一切呼ばない（DB もストレージも Supabase を直接叩く）ため権限は使われないが、既定のアカウントはプロジェクトの編集者権限を持つため厳密には過剰。**リビジョン編集で後から差し替え可能**なので、まず動かすことを優先した（→ [残っているタスク](../TODO.md#残っているタスク)）。

### Cloud Build が失敗する 2 つの原因

**初回デプロイは 2 回連続で失敗した。** どちらも Cloud Run 側の設定ではなく Cloud Build 側の問題で、症状が似ているので切り分け方とあわせて残す。

**原因1: Developer Connect の権限不足（ソース取得の前で落ちる）**

```
FETCHSOURCE
ERROR: error fetching DeveloperConnect credentials:
googleapi: Error 403: Permission 'developerconnect.gitRepos...'
```

所要 11 秒・全ステップ未実行で終わる。ビルドトリガーの編集画面に黄色い警告と「**すべて付与**」ボタンが出ているので、それを押して `service-<番号>@gcp-sa-cloudbuild.iam.gserviceaccount.com` へ `roles/developerconnect.tokenAccessor` を付与する。**権限の反映は非同期**なので、作成直後の初回ビルドが反映前に走って落ちることがある。まず再試行するだけで通る場合もある。

**原因2: ビルドコンテキストが `docker/` になる（重要）**

```
Step 8/35 : COPY package.json pnpm-lock.yaml ./
COPY failed: file not found in build context: stat package.json: file does not exist
```

**Dockerfile のパス指定（`/docker/Dockerfile`）自体は正しく効いている。** 問題は Cloud Build が「**Dockerfile のあるディレクトリ＝ビルドコンテキスト**」として扱うこと。本プロジェクトの [`docker/Dockerfile`](../../../docker/Dockerfile) はリポジトリルートがコンテキストである前提（`COPY package.json ...`）なので噛み合わない。

Cloud Run のコンソールから作ったトリガーは、**構成が「Cloud Build 構成ファイル（yaml）」の「インライン」になっており、その場で YAML を編集できる**。「エディタを開く」から Build ステップを次のように直す。

```yaml
      # 修正前（docker がビルドコンテキストとして渡っている）
      - docker
      - '-f'
      - docker/Dockerfile

      # 修正後（コンテキストをリポジトリルートにし、末尾へ移す）
      - '--target'
      - runner
      - '-f'
      - docker/Dockerfile
      - '.'
```

あわせて 2 つ足した。`--target runner` は将来 Dockerfile の末尾にステージを追加したとき別物がデプロイされるのを防ぐため。`timeout: 1800s`（トップレベルに置く）は Cloud Build の**既定タイムアウトが 10 分**で、キャッシュ無しの初回ビルドが超える恐れがあるため。

**「ビルドを再試行」ではトリガーの修正が反映されない。** このボタンは**そのビルドが走った時点の構成のスナップショット**を再利用する。YAML を直したら **Cloud Build → トリガー → 「実行」** で手動実行すること。修正が効いたかは、ビルド詳細の `1: Build` 行に出る `docker build` のコマンド全文（`... -f docker/Dockerfile .` になっているか）で判別できる。

### 本番の環境変数

**2026-08-04 に設定済み。** Cloud Run のサービス設定 →「コンテナ、ネットワーキング、セキュリティ」→「変数とシークレット」に 9 個を登録する。

| 変数 | 値 | 備考 |
|---|---|---|
| `DATABASE_URL` | Supabase の Session pooler 接続文字列 | → [Supabase 接続文字列の選び方](supabase.md#supabase-接続文字列の選び方) |
| `AUTH_SECRET` | ランダムな長い文字列 | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` で生成 |
| `AUTH_URL` | Cloud Run のエンドポイント URL | **作成画面に表示されるので最初から設定できる**（上記）。末尾スラッシュは付けない |
| `AUTH_TRUST_HOST` | `true` | `src/shared/config/env.ts` の既定は `false`。ただし [`auth.ts`](../../../src/modules/auth/auth.ts) が `trustHost: true` を持つため、実際にはこれが無くても動く |
| `LOG_PRETTY` | `false` | 本番は JSON 出力（Cloud Logging が構造化ログとして扱う） |
| `STORAGE_TYPE` | `supabase` | |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `SUPABASE_STORAGE_BUCKET` | Supabase から取得した値 | `SERVICE_ROLE_KEY` は管理者権限の鍵。リポジトリに置かない。新形式では `secret` 側を使う（→ [Supabase の API キー形式](supabase.md#supabase-の-api-キー形式)） |

`PORT` は Cloud Run が `8080` を注入し `next start` がそれを読むため、こちらで設定する必要はない（`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されない）。

**必須は `DATABASE_URL` だけ**（[`env.ts`](../../../src/shared/config/env.ts) の Zod スキーマ）。不足があると起動時に `環境変数の検証に失敗しました: - <変数名>: ...` という日本語メッセージでコンテナが落ちるので、Cloud Run の「ログ」タブでこの文字列を探せば原因が分かる。

### デプロイ後の確認

外部から HTTP で確認できる範囲は次のとおり（実測値）。

```powershell
$base="https://<service>-<プロジェクト番号>.us-central1.run.app"
Invoke-WebRequest "$base/api/health" -UseBasicParsing            # {"data":{"status":"ok"}}
Invoke-WebRequest "$base/api/health?check=db" -UseBasicParsing   # {"data":{"status":"ok","db":"up"}}
Invoke-WebRequest "$base/login" -UseBasicParsing                 # 200
```

**CSS は `/_next/static/css/` ではなく `/_next/static/chunks/` に出る**（Next.js 16）。静的アセットの配信を確認するときはパスを決め打ちしないこと。

**自動デプロイの反映は JS チャンク名で判定する。** `main` へ push した後、`/login` の HTML に含まれるチャンク名が変われば新しいリビジョンに入れ替わっている。**CSS のハッシュは判定に使えない**（Tailwind は使用クラスの集合から CSS を生成するため、クラスが増えない変更ではハッシュが変わらない）。

```powershell
$l=(Invoke-WebRequest "$base/login" -UseBasicParsing).Content
([regex]::Matches($l,'/_next/static/chunks/[a-z0-9_\-]+\.js') | ForEach-Object { $_.Value }) | Select-Object -Unique
```

### 本番で動かさないもの

- **pg-boss ワーカー**は本番では起動しない。`src/worker/index.ts` は待受のみで登録済みジョブがゼロのため、常駐させても無料枠を消費するだけになる。実ジョブを追加する段階で、Cloud Run Jobs か常駐サービスかを改めて判断する。
  - **将来的には CSV アップロード / ダウンロードを worker に載せる想定**（2026-08-02 に判明）。その段階で worker 用イメージを `runner` から分離し、[standalone 化](docker-image.md#standalone-化の設計上の論点) も併せて検討する。
  - 起動コマンドは環境ごとに違う。**本番コンテナ内では `pnpm worker` ではなく `./node_modules/.bin/tsx src/worker/index.ts`** → [worker の起動コマンド](docker-image.md#worker-の起動コマンド)
- **`docker/docker-compose.yml` の `db` サービス**はローカル専用。本番は Supabase を使う。
