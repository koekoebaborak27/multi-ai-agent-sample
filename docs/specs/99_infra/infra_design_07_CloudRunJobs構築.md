# 07.1 手順6 Cloud Run Jobs（worker）を構築する

手順6（該当する場合のみ）。CSVダウンロードなど **worker を使う機能を有効にする場合だけ**実施する手順。worker 用イメージの用意・Cloud Run Jobs の作成・環境変数の設定。

インフラ構築手順書の一部。全体の目次と進め方は [`README.md`](README.md) を見ること。


所要時間の目安: 45 分。手順1〜5（[`infra_design_05_CloudRun構築.md`](infra_design_05_CloudRun構築.md) まで）が完了している前提。

> 画面が本書と異なる場合は [00.1.6](infra_design_00_概要と全体構成.md#0016-uiは資料と異なる可能性あり) を参照してください。

## 07.1.1 この手順が必要になる場合

**worker はジョブワーカー（pg-boss）を使う機能があるときだけ必要です。** テンプレート標準のマスタ機能では、CSVダウンロード（依頼→生成→受け取り）が worker を使います。案件によって worker を使う機能を採用しない場合、本書（07.1〜08.1）は不要です。

worker の実行方式（Cloud Run Jobs として単発実行し、app が起動する）の設計は、設計書 [`30_CSVダウンロード.md`](../02_basic-design/master/30_CSVダウンロード.md) §30.1.7 を参照してください。

## 07.1.2 worker 用のコンテナイメージを用意する

**この時点では、Cloud Build による自動ビルドはまだ設定されていません。** app 用のビルド設定（[05.1.6](infra_design_05_CloudRun構築.md#0516-cloud-build-のビルド設定を修正する)）は `--target runner` を指定しており、worker 用のイメージは作られません。自動化はあとの工程（Cloud Build のトリガーに worker 用のビルドを追加する）で行うため、**この手順では一度だけ手動でビルドして登録します。**

### イメージの登録先（Artifact Registry）を確認する

app のビルド（[05.1.6](infra_design_05_CloudRun構築.md#0516-cloud-build-のビルド設定を修正する)）により、Artifact Registry に `cloud-run-source-deploy` という名前のリポジトリが自動的に作られています。左メニューの **Artifact Registry** から確認できます。worker 用のイメージも同じリポジトリへ登録します。

### ビルドして登録する

PC 上で、Google Cloud への認証と Docker の設定を行います（初回のみ）。

```powershell
gcloud auth login
gcloud auth configure-docker us-central1-docker.pkg.dev
```

worker 用イメージをビルドし、push します。**リポジトリのルート**（`docker/Dockerfile` があるディレクトリの1つ上）で実行してください。

```powershell
$project="<プロジェクトID>"
$image="us-central1-docker.pkg.dev/$project/cloud-run-source-deploy/worker:latest"

docker build --target worker -f docker/Dockerfile -t $image .
docker push $image
```

> **`--target worker` を忘れないでください。** 指定しない場合、既定の最終ステージ（`runner`）がビルドされ、`next start` が起動コマンドになってしまいます。

## 07.1.3 Cloud Run Jobs を作成する

左メニューの **Cloud Run** → 上部タブの **「ジョブ」** → **「ジョブの作成」** を開きます。

| 項目 | 設定値 | 理由 |
| --- | --- | --- |
| **コンテナイメージ** | 上記で push したイメージ（`.../worker:latest`） | |
| **ジョブ名** | 任意（例: `contract-worker`） | **作成後は変更できません** |
| **リージョン** | **`us-central1`（アイオワ）** | app のサービスと同じリージョンにする |
| **コンテナの引数** | `--once` | 単発実行にする（[`docker/Dockerfile`](../../../docker/Dockerfile) の `worker` ステージ参照）。指定しないと常駐モードのまま終了しない |
| タスクの数 | `1`（既定） | pg-boss のキュー全体を1タスクで処理する設計 |
| 並列実行数 | `1`（既定） | 同上 |
| タスクごとの最大再試行回数 | `3`（既定のまま） | worker 側は `QUEUED` でない依頼を無視する保険があるため、再試行しても害はない（設計書§30.1.5.2） |
| メモリ | `512 MiB`（既定） | app と同じ想定で十分（§30.1.8 の10,000行上限を参照） |
| タスクのタイムアウト | `600`秒（既定のまま） | CSV生成は数秒〜数十秒で終わる想定 |
| **サービス アカウント** | ひとまず既定のまま | [1-4](../../todo/TODO.md) で専用サービスアカウントへ差し替える |

「作成」を押すと、ジョブが登録されます。**この時点では実行されません。**（実行して確認する手順は [`infra_design_08_CloudRunJobs動作確認.md`](infra_design_08_CloudRunJobs動作確認.md)）

## 07.1.4 環境変数を設定する

ジョブの編集画面（「新しいリビジョンの編集とデプロイ」に相当）の「変数とシークレット」で、次の 6 個を登録します。**app 用（[05.1.5](infra_design_05_CloudRun構築.md#0515-環境変数を設定する)）と異なり、`AUTH_*` 系は不要です。** worker は認証処理を行わないためです。

| 変数名 | 値 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | app と同じ接続文字列（[03.1.3](infra_design_03_Supabase作成.md#0313-接続文字列を取得する)） | Session pooler のもの |
| `LOG_PRETTY` | `false` | 本番は構造化ログ（JSON 形式）で出力する |
| `STORAGE_TYPE` | `supabase` | ファイルの保管先を Supabase に切り替える |
| `SUPABASE_URL` | app と同じ値（[03.1.5](infra_design_03_Supabase作成.md#0315-api-キーを取得する)） | |
| `SUPABASE_SERVICE_ROLE_KEY` | app と同じ値（[03.1.5](infra_design_03_Supabase作成.md#0315-api-キーを取得する)） | **管理者権限の鍵です** |
| `SUPABASE_STORAGE_BUCKET` | `uploads` | app と同じバケット名 |

> `DATABASE_URL` が未設定の場合、worker はコンテナ起動直後に「環境変数の検証に失敗しました」を出して異常終了します（[`src/shared/config/env.ts`](../../../src/shared/config/env.ts)）。**他の5項目は未設定でも起動はしますが、CSV生成やファイル保存が失敗します。**

## 07.1.5 app 側に worker の起動先を設定する

app（既存の Cloud Run サービス）の環境変数へ、次の 3 項目を追加します。「新しいリビジョンの編集とデプロイ」から行います（[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値)）。

| 変数名 | 値 | 説明 |
| --- | --- | --- |
| `WORKER_INVOKE_MODE` | `cloud-run-job` | 既定の `none` から切り替える。依頼のたびに worker（Cloud Run Jobs）を起動する |
| `CLOUD_RUN_JOB_NAME` | [07.1.3](#0713-cloud-run-jobs-を作成する) で決めたジョブ名 | |
| `CLOUD_RUN_JOB_REGION` | `us-central1` | |

`GOOGLE_CLOUD_PROJECT` は Cloud Run 上では既定で自動設定されるため、通常は追加不要です（[`src/shared/config/env.ts`](../../../src/shared/config/env.ts)）。

## 07.1.6 app にジョブ実行権限を付与する

app の実行サービスアカウント（[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値) の「サービスアカウントについて」）に、作成した Cloud Run Jobs を実行する権限が必要です。

1. **IAM と管理** → **IAM** を開きます。
2. app の実行サービスアカウント（例: `<プロジェクト番号>-compute@developer.gserviceaccount.com`）を編集します。
3. ロール **「Cloud Run 起動元」（`roles/run.invoker`）** を追加します。

> **この付与により、[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値) の「権限を持たない専用サービスアカウントへの差し替え」は「必要な権限だけを持つ専用サービスアカウントへの差し替え」に変わります。** 権限ゼロは成立しなくなりますが、Cloud Run Jobs 1個の実行権限のみであり、既定のサービスアカウントが持つ編集者権限とは比較にならないほど狭い権限です（設計書§30.1.7.3）。

設定が終わったら、[`infra_design_08_CloudRunJobs動作確認.md`](infra_design_08_CloudRunJobs動作確認.md) へ進みます。
