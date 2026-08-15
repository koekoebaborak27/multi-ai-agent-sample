# 07.1 手順6 Cloud Run Jobs（worker）を構築する

手順6（該当する場合のみ）。CSVダウンロードなど **worker を使う機能を有効にする場合だけ**実施する手順。worker 用イメージの用意・Cloud Run Jobs の作成・環境変数の設定。

インフラ構築手順書の一部。全体の目次と進め方は [`README.md`](README.md) を見ること。


所要時間の目安: 45 分。手順1〜5（[`infra_design_05_CloudRun構築.md`](infra_design_05_CloudRun構築.md) まで）が完了している前提。

> 画面が本書と異なる場合は [00.1.6](infra_design_00_概要と全体構成.md#0016-uiは資料と異なる可能性あり) を参照してください。

## 07.1.1 この手順が必要になる場合

**worker はジョブワーカー（pg-boss）を使う機能があるときだけ必要です。** テンプレート標準のマスタ機能では、CSVダウンロード（依頼→生成→受け取り）が worker を使います。案件によって worker を使う機能を採用しない場合、本書（07.1〜08.1）は不要です。

worker の実行方式（Cloud Run Jobs として単発実行し、app が起動する）の設計は、設計書 [`30_CSVダウンロード.md`](../02_basic-design/master/30_CSVダウンロード.md) §30.1.7 を参照してください。

## 07.1.2 worker 用のコンテナイメージを用意する

**ここで行うこと**: worker（CSV 生成など、時間のかかる処理を裏側で動かすプログラム）を、Google Cloud 上に送信して登録します。次の4ステップです。

1. PC から Google Cloud にログインする（初回のみ）
2. PC の Docker が Google Cloud へ送信できるように設定する（初回のみ）
3. worker を「コンテナイメージ」（プログラムとその実行に必要なものを1つにまとめたファイル。Google Cloud 上で動かすにはこの形式にする必要がある）に変換する（**ビルド**すると言います）
4. 変換したコンテナイメージを Google Cloud へ送る（**push** すると言います）

以下、この4ステップを順番に進めます。

> **なぜここだけ PC 上でコマンドを打つのか**: 手順1〜5（[`infra_design_02_GitHubリポジトリ.md`](infra_design_02_GitHubリポジトリ.md)〜[`infra_design_06_CloudRun動作確認.md`](infra_design_06_CloudRun動作確認.md)）はすべてブラウザ操作でした。app（Webサイト本体）は GitHub へ push すると Google Cloud 側が自動でコンテナイメージへ変換してくれるため、PC 上でコマンドを打つ必要がなかったのです。worker 用の自動変換はまだ設定されておらず（あとの工程 1-5 で対応します）、それまでの間はこの節だけ一度限りの手作業で行います。

**事前に必要なもの**: 操作場所はブラウザではなく PC の PowerShell（ターミナル）です。「gcloud CLI」（Google Cloud をコマンドで操作するための専用ソフト）が入っていない場合は、先に [事前準備 §01.1.2](infra_design_01_事前準備.md#0112-用意するツール) の手順でインストールしてください。

### ① PC から Google Cloud にログインする（初回のみ）

```powershell
gcloud auth login
```

実行するとブラウザが自動で開きます。**普段 Google Cloud を操作しているのと同じ Google アカウント**でログインしてください。

### ② Docker が Google Cloud へ送信できるようにする（初回のみ）

```powershell
gcloud auth configure-docker us-central1-docker.pkg.dev
```

このあとの④「送信する」を、PC 上の Docker が Google Cloud に対して行えるようにするための、一度きりの設定です。

### ③ worker をコンテナイメージに変換する（ビルドする）

まず、PC の gcloud にどの Google Cloud プロジェクトを使うか設定されているか確認します。

```powershell
gcloud config get-value project
```

`(unset)` と表示された場合や、違うプロジェクトIDが表示された場合は、次のコマンドで設定してください（`<プロジェクトID>` は Google Cloud コンソール左上のプロジェクト選択メニューで確認できます。[05.1.2](infra_design_05_CloudRun構築.md#0512-google-cloud-プロジェクトを作成する) で決めたものです）。

```powershell
gcloud config set project <プロジェクトID>
```

以下を実行する前に、PowerShell の場所（カレントディレクトリ）が**このリポジトリの一番上の階層**（`docker` フォルダと同じ階層。`prisma` や `src` フォルダもここにあります）になっていることを確認してください。

`<プロジェクトID>` の部分は、上記で確認・設定したプロジェクト ID に書き換えてください。

```powershell
$project="<プロジェクトID>"
$image="us-central1-docker.pkg.dev/$project/cloud-run-source-deploy/worker:latest"

docker build --target worker -f docker/Dockerfile -t $image .
```

[`docker/Dockerfile`](../../../docker/Dockerfile) には、app 用と worker 用、2種類の変換手順がまとめて書かれています。`--target worker` を付けることで「worker 用の手順だけを使ってください」と指定しています。

> **`--target worker` を書き忘れないでください。** 書き忘れると既定の app 用の手順で変換されてしまい、worker として動きません。

### ④ 変換したコンテナイメージを Google Cloud へ送る（push する）

**③と同じ PowerShell の画面で続けて**、次を実行してください（`$project` や `$image` は③で設定した値をそのまま使います）。

```powershell
docker push $image
```

送信先の `cloud-run-source-deploy` という保管場所（Artifact Registry）は、app 用のビルド（[05.1.6](infra_design_05_CloudRun構築.md#0516-cloud-build-のビルド設定を修正する)）のときに Google Cloud が自動で作ってくれたものです。worker のコンテナイメージも同じ場所へ送ります。

### 送信できたか確認する

ブラウザで Google Cloud コンソールを開いてください。**「Artifact Registry」は左メニューの一覧に出てこないことがあります。** その場合は、画面上部の検索バー（虫眼鏡アイコン。キーボードの `/` キーでも開きます）に「Artifact Registry」と入力し、候補から開いてください。

開いたら **`cloud-run-source-deploy`** をクリックしてください。`worker` という名前のイメージが増えていれば成功です。

ここまでで PC 上での作業は終わりです。ここから先（[07.1.3](#0713-cloud-run-jobs-を作成する) 以降）は、再びブラウザでの Google Cloud コンソール操作に戻ります。

## 07.1.3 Cloud Run Jobs を作成する

左メニューの **Cloud Run** → 上部タブの **「ジョブ」** → **「ジョブの作成」** を開きます。

> 画面の項目名や配置は Google Cloud 側の更新で変わることがあります（[00.1.6](infra_design_00_概要と全体構成.md#0016-uiは資料と異なる可能性あり)）。下表と違う項目名や配置になっていても、**表の「設定値」をすべて入力できていれば結果は同じ**です。迷ったら、画面をスクリーンショットで撮って Claude Code などの AI エージェントに読み込ませ、「この項目はどこにありますか」と聞くのも有効です。

まず画面の上のほうにある基本項目を入力します。

| 項目 | 設定値 | 理由 |
| --- | --- | --- |
| **コンテナイメージ** | 上記で push したイメージ（`.../worker:latest`） | |
| **ジョブ名** | 任意（例: `contract-worker`） | **作成後は変更できません** |
| **リージョン** | **`us-central1`（アイオワ）** | app のサービスと同じリージョンにする |

次に **「コンテナ、接続、セキュリティ」**（画面によっては「コンテナ、変数とシークレット、接続、セキュリティ」）という折りたたみ項目を開き、**「コンテナの編集」→「設定」タブ**で以下を入力します。

| 項目 | 設定値 | 理由 |
| --- | --- | --- |
| **コンテナの引数** | `--once` | 単発実行にする（[`docker/Dockerfile`](../../../docker/Dockerfile) の `worker` ステージ参照）。指定しないと常駐モードのまま終了しない |
| メモリ | `512 MiB`（既定） | app と同じ想定で十分（§30.1.8 の10,000行上限を参照） |

続いて、画面下方（またはコンテナ編集の外）にある以下の項目を確認します（既定値のままで問題ありません）。

| 項目 | 設定値 | 理由 |
| --- | --- | --- |
| タスクの数 | `1`（既定） | pg-boss のキュー全体を1タスクで処理する設計 |
| 並列実行数（並列処理） | `1`、または「できる限り多くのタスクを同時実行する」（既定） | タスクの数が1なのでどちらでも結果は同じ |
| タスクごとの最大再試行回数 | `3`（既定のまま） | worker 側は `QUEUED` でない依頼を無視する保険があるため、再試行しても害はない（設計書§30.1.5.2） |
| タスクのタイムアウト | `600`秒（既定のまま。「分」単位の画面では `10`分） | CSV生成は数秒〜数十秒で終わる想定 |
| **サービス アカウント** | ひとまず既定のまま | [1-4](../../todo/TODO.md) で専用サービスアカウントへ差し替える |
| **「すぐにジョブを実行する」** | **チェックしない** | 登録だけ行い、動作確認は [08.1](infra_design_08_CloudRunJobs動作確認.md) で別途行う |

環境変数（次の [07.1.4](#0714-環境変数を設定する)）を入力してから、最後に「完了」→ 画面下部の **「作成」** を押してください。ジョブが登録されます。**この時点では実行されません。**（実行して確認する手順は [`infra_design_08_CloudRunJobs動作確認.md`](infra_design_08_CloudRunJobs動作確認.md)）

## 07.1.4 環境変数を設定する

**「コンテナの編集」パネルの中にある「変数とシークレット」タブ**（「設定」タブの隣）で、次の 6 個を登録します。**app 用（[05.1.5](infra_design_05_CloudRun構築.md#0515-環境変数を設定する)）と異なり、`AUTH_*` 系は不要です。** worker は認証処理を行わないためです。

> ジョブ作成後に改めて編集する画面（「新しいリビジョンの編集とデプロイ」）でも同じ「変数とシークレット」タブから設定できます。作成時にまとめて入力しても、後から編集しても構いません。

**`DATABASE_URL` と `SUPABASE_SERVICE_ROLE_KEY` は、直接値を入力せず「シークレットを参照」を選んでください。** [05.1.5](infra_design_05_CloudRun構築.md#0515-環境変数を設定する) の事前準備1で作成した `database-url` / `supabase-service-role-key` をそのまま参照します（新しく作り直す必要はありません）。Cloud Run は環境変数を直接値で設定すると、実行のたびに監査ログへ値がそのまま複製されるため、Cloud Logging を見られる人なら誰でも読めてしまいます。

| 変数名 | 設定方法 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | シークレットを参照: `database-url` / `latest` | Session pooler のもの |
| `LOG_PRETTY` | 直接値: `false` | 本番は構造化ログ（JSON 形式）で出力する |
| `STORAGE_TYPE` | 直接値: `supabase` | ファイルの保管先を Supabase に切り替える |
| `SUPABASE_URL` | 直接値: app と同じ値（[03.1.5](infra_design_03_Supabase作成.md#0315-api-キーを取得する)） | 公開情報のため直接値でよい |
| `SUPABASE_SERVICE_ROLE_KEY` | シークレットを参照: `supabase-service-role-key` / `latest` | **管理者権限の鍵です** |
| `SUPABASE_STORAGE_BUCKET` | 直接値: `uploads` | app と同じバケット名 |

> `DATABASE_URL` が未設定の場合、worker はコンテナ起動直後に「環境変数の検証に失敗しました」を出して異常終了します（[`src/shared/config/env.ts`](../../../src/shared/config/env.ts)）。**他の4項目は未設定でも起動はしますが、CSV生成やファイル保存が失敗します。**

> **worker 用のサービスアカウントにも参照権限が必要です。** [05.1.5 の事前準備2](infra_design_05_CloudRun構築.md#0515-環境変数を設定する) で app の実行サービスアカウントへ付与済みですが、worker が別のサービスアカウントを使う場合（[1-4](../../todo/TODO.md) で専用アカウントへ差し替えた場合など）は、`database-url` / `supabase-service-role-key` それぞれの「権限」タブで、そのアカウントにも `roles/secretmanager.secretAccessor` を追加してください。

## 07.1.5 app 側に worker の起動先を設定する

app（既存の Cloud Run サービス）の環境変数へ、次の 4 項目を追加します。「新しいリビジョンの編集とデプロイ」から行います（[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値)）。

| 変数名 | 値 | 説明 |
| --- | --- | --- |
| `WORKER_INVOKE_MODE` | `cloud-run-job` | 既定の `none` から切り替える。依頼のたびに worker（Cloud Run Jobs）を起動する |
| `CLOUD_RUN_JOB_NAME` | [07.1.3](#0713-cloud-run-jobs-を作成する) で決めたジョブ名 | |
| `CLOUD_RUN_JOB_REGION` | `us-central1` | |
| `GOOGLE_CLOUD_PROJECT` | プロジェクト ID（[05.1.2](infra_design_05_CloudRun構築.md#0512-google-cloud-プロジェクトを作成する) で決めたもの） | worker（Cloud Run Jobs）がどのプロジェクトに属するかを表す（[`src/shared/config/env.ts`](../../../src/shared/config/env.ts)）。**必ず明示的に設定してください。自動で設定されるとは限りません**（環境変数を一括で設定し直した際に消えて起動エラーになった実例があります） |

## 07.1.6 app にジョブ実行権限を付与する

app の実行サービスアカウント（[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値) の「サービスアカウントについて」）に、作成した Cloud Run Jobs を実行する権限が必要です。

1. **IAM と管理** → **IAM** を開きます。
2. app の実行サービスアカウント（例: `<プロジェクト番号>-compute@developer.gserviceaccount.com`）を編集します。
3. ロール **「Cloud Run 起動元」（`roles/run.invoker`）** を追加します。

> **この付与により、[05.1.4](infra_design_05_CloudRun構築.md#0514-サービスの設定値) の「権限を持たない専用サービスアカウントへの差し替え」は「必要な権限だけを持つ専用サービスアカウントへの差し替え」に変わります。** 権限ゼロは成立しなくなりますが、Cloud Run Jobs 1個の実行権限のみであり、既定のサービスアカウントが持つ編集者権限とは比較にならないほど狭い権限です（設計書§30.1.7.3）。

設定が終わったら、[`infra_design_08_CloudRunJobs動作確認.md`](infra_design_08_CloudRunJobs動作確認.md) へ進みます。
