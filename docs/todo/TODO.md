	# TODO

汎用契約管理システムテンプレート（[`foundation_plan.md`](../foundation_plan.md)）の**残タスクと現在地**。

**このファイルには「いま何が残っているか」だけを書く。** 設計・手順・経緯は下表の担当ファイルへ書き、ここからはリンクするだけにする。同じ内容を 2 か所に置かない。

| 書きたいこと | 書く場所 |
| ------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **残タスク・進捗・次の一手** | **このファイル** |
| マスタ機能の設計・仕様の決定 | [`docs/specs/02_basic-design/master/`](../specs/02_basic-design/master/README.md)（`docs/specs/` が設計の正本） |
| 土台の設計・確定方針 | [`foundation_plan.md`](../foundation_plan.md) |
| 本番構築の手順・本番構成・環境変数 | [`docs/specs/99_infra/`](../specs/99_infra/README.md) |
| 設定値・落とし穴・実測値 | [`docs/todo/notes/`](notes/README.md)（冒頭に節ごとの目次がある） |
| 何をやったか・なぜ・どこで詰まったか | [`docs/todo/history/`](history/README.md)（古い順。新しい記録は末尾へ） |
| UI / デザイン規約 | [`DESIGN.md`](../../DESIGN.md)（一覧テーブル・検索条件を含む） |
| セットアップ・開発フロー・デバッグ手順 | [`README.md`](../../README.md) |
| Prisma マイグレーションの運用 | [`prisma_operations.md`](../prisma_operations.md) |

このファイルの更新手順は [`docs/skills/update-todo.md`](../skills/update-todo.md)（`/update-todo` の正本）。

## 進捗サマリ

**進捗を書くのはこの表だけ。** 他の節に「N / M 完了」を重ねて書かない。

| 区分 | 進捗 |
| ------------------------- | ------------------- |
| 土台（ローカル環境 / Git / Supabase / 署名 URL / Docker 軽量化 / Cloud Run） | 48 / 48 |
| マスタ機能（設計） | 6 / 6 |
| **マスタ機能（製造。工程1〜18＋第5段階1〜4）** | **22 / 22** |
| Cloud Run Jobs本番構成の構築（workerサンプルの土台） | 3 / 7 |
| マスタ情報Excel取得機能（workerサンプル） | 7 / 9 工程 |
| 残っているタスク（期限なしの宿題） | 未対応 9 件 |

土台は 2026-08-04 に本番稼働へ到達した。内訳は [完了済みの作業](#完了済みの作業)。

## 次にやること

**マスタ機能の製造（工程1〜18＋第5段階1〜4）が完了した。** 直近では2026-08-16に本番DBへ `drop_master_export` マイグレーションを適用し、使われなくなった `MasterExport` テーブルを削除した（詳しい経緯は [履歴](history/README.md) を参照）。

「マスタ情報Excel取得機能（workerサンプル）」の工程7、**マスタ管理画面への導線ボタンの追加が完了した**（2026-08-18）→ [履歴](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能の画面への導線ボタンを追加)。

次は工程8、**本番構成を仕上げる**。Cloud Run Jobs本番構成の構築の残り（4〜7: app→worker起動処理・専用サービスアカウント・Cloud Build自動化）を完了させ、タイムアウトを900秒に見直し、本番デプロイと動作確認まで行う（設計書 §40.7.3・§40.7.4）。

手元の状態を確認するコマンド:

```powershell
git log --oneline -1                                     # 現在のコミット
git status --porcelain                                   # 未コミット差分がないか確認
```

## マスタ機能の製造工程

設計書 [`docs/specs/02_basic-design/master/`](../specs/02_basic-design/master/README.md) を実装の正本とする。**マスタ機能本体の製造（18工程＋本番で仕上げる第5段階1〜4、計22項目）は完了した**（2026-08-16）。実施内容・検証結果は [完了済みの作業](#完了済みの作業) の「マスタ機能の製造」の行から履歴をたどること。

残るのは worker サンプルの土台（下記）と、それを使う「マスタ情報Excel取得機能」（次節）。

### Cloud Run Jobs本番構成の構築（workerサンプル機能の土台）

**当初はマスタCSVダウンロードのために着手したが、CSVが同期方式に変わったため、現在は下記「マスタ情報Excel取得機能」で再利用する土台という位置づけ。** 手順は [`docs/specs/99_infra/` §07.1](../specs/99_infra/infra_design_07_CloudRunJobs構築.md#071-手順6-cloud-run-jobsworkerを構築する)。

- [x] 1. worker専用の実行用イメージ（アプリを動かすための入れ物）を用意する（2026-08-15）→ [履歴](history/2026-08-w3.md#2026-08-15-worker専用の実行用イメージをdockerfileに用意)
- [x] 2. 「Cloud Run Jobs」（本番で worker を1回だけ動かす仕組み）を作る。データベースへの接続先やファイルの保存先の設定値も一緒に登録する（2026-08-15）→ [履歴](history/2026-08-w3.md#2026-08-15-cloud-run-jobsを構築しapp側の起動設定と実行権限を追加)
- [x] 3. パスワードや鍵にあたる環境変数（`DATABASE_URL` / `AUTH_SECRET` / `SUPABASE_SERVICE_ROLE_KEY`）を、直接値ではなく Secret Manager 経由に切り替える（2026-08-15）→ [履歴](history/2026-08-w3.md#2026-08-15-cloud-run-jobs単体実行で監査ログへの機密情報平文記録を発見しsecret-manager化で対応)
- [ ] 4. アプリから worker を呼び出す処理を作る — CSV用に一度実装した（[履歴](history/2026-08-w3.md#2026-08-15-アプリからworkerを呼び出す処理を実装)）が、CSVの同期化に伴いコード（`src/shared/jobs/invoke-worker.ts`）ごと削除した。実装時はこの履歴を参考に作り直す
- [ ] 5. 本番のアプリ側に「worker は Cloud Run Jobs で動かす」という設定値を追加する — 同上の理由で削除済み（`WORKER_INVOKE_MODE` 等）。作り直す
- [ ] 6. worker 専用の実行アカウントを作り、アプリ側からそのJobsを起動できる権限だけを与える。TODO に残っている宿題「実行アカウントを権限なしのものに差し替える」を、「必要最小限の権限だけ持たせる」という形に直して一緒に片づける。**実行権限の付与自体は完了済み（既定のサービスアカウントに付与）。残作業は専用アカウントの新規作成と差し替え**
- [ ] 7. 本番への自動反映の仕組み（Cloud Build）が、アプリ用の入れ物と同時に worker 用の入れ物も作り直すようにする

## マスタ情報Excel取得機能の製造工程（workerサンプル）

worker（Cloud Run Jobs）の利用サンプルとして「依頼 → worker生成 → 受け取り」の型でExcel出力バッチを作る。設計書は [`40_マスタ情報Excel取得.md`](../specs/02_basic-design/master/40_マスタ情報Excel取得.md)。

Cloud Run Jobs自体の土台（イメージ・ジョブ本体・DB接続・Secret Manager）は上記「Cloud Run Jobs本番構成の構築」の1〜3で完成済み。残るのは同4〜7（app→worker起動処理の作り直し・専用サービスアカウント・Cloud Build自動化）で、下記工程7で仕上げる。

- [x] **1. 設計書を作成する**（2026-08-17）→ [`40_マスタ情報Excel取得.md`](../specs/02_basic-design/master/40_マスタ情報Excel取得.md)
- [x] **2. Excel出力の依頼処理とデータモデルを実装する**（2026-08-17）→ [履歴](history/2026-08-w3.md#2026-08-17-マスタ情報excel取得機能の依頼処理とデータモデルを実装)
- [x] **3. Excelを生成するworkerを実装する**（2026-08-17）→ [履歴](history/2026-08-w3.md#2026-08-17-マスタ情報excel取得機能のexcel生成workerを実装)
- [x] **4. 「マスタ情報Excel取得」画面を実装する**（`/master/exports`）（2026-08-18）→ [履歴](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能の画面を実装)
- [x] **5. 履歴一覧からのダウンロード処理を実装する**（2026-08-18）→ [履歴](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能のダウンロード処理を実装)
- [x] **6. 保持期限切れファイルの掃除をworkerに実装する**（2026-08-18）→ [履歴](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能の保持期限切れファイル掃除処理を実装)
- [x] **7. マスタ管理画面にこの画面へのボタンを追加する**（2026-08-18）→ [履歴](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能の画面への導線ボタンを追加)
- [ ] **8. 本番構成を仕上げる** — 上記「Cloud Run Jobs本番構成の構築」の残り（4〜7: app→worker起動処理・専用サービスアカウント・Cloud Build自動化）を完了させ、タイムアウトを900秒に見直し、本番デプロイと動作確認まで行う（設計書 §40.7.3・§40.7.4）
- [ ] **9. 単体テストを実施する**

## マスタ分類の見直し
- [ ] **1. マスタ分類にユーザが入力できる分類コードを追加する** — マスタ関連の実装が完了したのち着手する。テーブルの PK であるマスタ分類 ID とは別に、分類コードの列を持たせる
- [ ] **2. 「契約先分類」と「契約分類」をマスタ分類の初期データとして投入する** — 分類コードはそれぞれ `CONTRACT_COMPANY_TYPE`・`CONTRACT_TYPE`。上記の分類コード追加後に対応する
- [ ] **3. 契約先情報の分類を「契約先分類」に変更する** — マスタ分類が「契約先分類」（分類コード `CONTRACT_COMPANY_TYPE`）であるマスタのデータを選択・設定できるようにする
- [ ] **4. 契約情報に「契約分類」を追加する** — マスタ分類が「契約分類」（分類コード `CONTRACT_TYPE`）であるマスタのデータを選択・設定できるようにする

## 残っているタスク

いずれも**期限のない宿題**。判断材料は各リンク先にまとまっている。

- [ ] **`main` のブランチ保護をどうするか決める** — 当面は運用ルールで守る。選択肢 3 つと確認コマンドは [`docs/specs/99_infra/` §02.1.6](../specs/99_infra/infra_design_02_GitHubリポジトリ.md#0216-ブランチ保護を設定する)
- [ ] **ドキュメントのみの変更で Cloud Build を走らせない仕組みを入れるか決める** — 当面は放置。選択肢 3 つは [`docs/specs/99_infra/` §09.1.1](../specs/99_infra/infra_design_09_構築後の運用.md#0911-本番へ反映する)
- [ ] **`output: "standalone"` 化を検討する** — 「Cloud Run Jobs本番構成の構築」の1で worker 用イメージの分離が完了し、着手条件は整った。論点・落とし穴 5 つ・検証コマンドは [`docs/todo/notes/`](notes/docker-image.md#standalone-化の設計上の論点)
- [ ] **マイグレーションの自動化を検討する** — 当面はローカルからの手動 `prisma migrate deploy`。理由と手順は [`prisma_operations.md`](../prisma_operations.md)、[`docs/specs/99_infra/` §09.1.2](../specs/99_infra/infra_design_09_構築後の運用.md#0912-データベースの構造を変更する)
- [ ] **`/update-todo` が GitHub Copilot Chat で起動するか確認する**（`chat.promptFiles` が有効なこと）— Claude Code と Codex では確認済み
- [ ] **Prismaのマイグレーション履歴を1本に統合するか検討する** — 今のこの本番運用中プロジェクトでは統合しない（本番DBの`_prisma_migrations`の記録とファイルの中身が食い違い、次回の`prisma migrate deploy`が失敗するため。[`prisma_operations.md`](../prisma_operations.md) §1-6「やってはいけないこと」参照）。次にこのリポジトリを新しい案件のテンプレートとして複製する際（[`foundation_plan.md`](../foundation_plan.md) §9、Supabase/Google Cloudのプロジェクトを新規作成するタイミング）、真っさらなDBに対して `migrations` を1本の初期マイグレーションへ作り直すことを検討する


## 現在の状態

事実のみ。予定・経緯・仕様は書かない。

| 項目 | 状態 |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 作業ブランチ | `feat/master-excel-export-model`（マスタ情報Excel取得機能の依頼処理・データモデル・worker・画面・ダウンロード・掃除処理・導線ボタンを追加。工程2〜7）で作業中、未PR。工程7分（`src/app/(main)/master/page.tsx`）はまだ未コミット。`feat/master-csv-sync`（マスタCSVを同期方式へ作り直す変更）が [PR #16](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/16)、`feat/worker-image`（worker用イメージの分離）が [PR #15](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/15)、`feat/infra-cloud-run-jobs`（appからworkerを呼び出す処理の追加）が [PR #14](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/14)、`feat/master-management`（工程 1〜18）が [PR #13](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/13) でそれぞれマージ済み、リモート・ローカルとも削除済み |
| 本番 DB | `20260815153832_drop_master_export` まで**適用済み**（2026-08-16、第5段階の4で反映。使われなくなった `MasterExport` テーブルを削除） |
| ローカル DB | Docker Compose の PostgreSQL 16 は**起動中**。マスタ分類 2 件・マスタ 35 件（ページング確認用）が入っている。`MasterExcelExport` テーブルを追加済み（2026-08-17）。動作確認で作成した実行履歴・ファイルは確認後に削除済み |
| ブラウザ検証 | 工程 18（18-1〜18-10）でマスタ分類一覧・新規登録・詳細・更新・削除（MST-06〜10）とマスタ検索一覧・新規登録・詳細・更新・削除（MST-01〜05）を ADMIN/OPERATOR/VIEWER の各ロールで Playwright により実機確認済み。CSV同期方式への変更後は、ローカル・本番（2026-08-16）の両方でマスタ・マスタ分類双方のCSVダウンロードをブラウザで確認済み（待ち時間なし） |
| 直近の検証 | 2026-08-18、ローカルで`/master`画面への導線ボタン追加を実機確認。見出し右側に「マスタ管理情報Excel作成」「マスタ分類の管理」が左からこの順・同じ色で並ぶこと、クリックで`/master/exports`へ遷移し戻れること、幅375pxでも横スクロールが出ず縦積みになること、一覧領域のCSVダウンロード等の並びが変わっていないことを確認済み。本番URL（`contract-app`）での直近の確認は2026-08-16のCSVダウンロード（待ち時間なく動作、最新リビジョン `contract-app-00027-kqd`） |
| 本番 | **稼働中**（Cloud Run `contract-app` / us-central1、`https://contract-app-4i3b5yuroq-uc.a.run.app`）。Cloud Run Jobs `contract-worker`（us-central1）は `SUPABASE_URL` 設定漏れを2026-08-16に修正済み。機密環境変数3項目はSecret Manager経由。`feat/master-csv-sync` はデプロイ済みで、CSVダウンロードは新しい同期方式で稼働中。構成・設定値・URL は [`docs/specs/99_infra/`](../specs/99_infra/README.md) |
| ブランチ保護 | **かかっていない**。PR 運用は運用ルールで守っている（→ [残っているタスク](#残っているタスク)） |

## 完了済みの作業

各区分の実施内容・判断・詰まった点は [`docs/todo/history/`](history/README.md) にセッション単位で残している。

| 区分 | 件数 | 記録 |
| ---------------------- | ---- | ---------------------------------------------------------------------------------------- |
| ローカル環境 | 10 | [Git の初期化](history/2026-07.md#2026-07-28-git-の初期化とコミット前チェック)・[VSCode デバッグ](history/2026-08-w1.md#2026-08-03-vscode-デバッグ環境の整備) |
| Git と GitHub | 13 | [GitHub と CI](history/2026-08-w1.md#2026-08-01-github-と-ci)・[PR 運用の開始](history/2026-08-w1.md#2026-08-02-pr-運用の開始と-ci-の順序バグ修正)・[CI のスキップ設定](history/2026-08-w1.md#2026-08-02-開発フローの-readme-化と-ci-のスキップ設定) |
| Supabase（本番 DB / Storage） | 6 | [Supabase セットアップ](history/2026-08-w1.md#2026-08-01-supabase-セットアップ)・[本番 DB の構築と疎通確認](history/2026-08-w1.md#2026-08-02-本番-db-の構築と-storage-の疎通確認) |
| 1. 署名 URL 化（PR #7） | 5 | [署名 URL 化](history/2026-08-w1.md#2026-08-02-署名-url-化) |
| 2. Docker イメージの軽量化（PR #8 / #9） | 6 | [軽量化と worker の .env 依存解消](history/2026-08-w1.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)（1.73GB → 1.31GB。当初の standalone 化から差し替え） |
| 3. Google Cloud Run（PR #11） | 8 | [Cloud Run の構築とログイン不能バグの修正](history/2026-08-w1.md#2026-08-04-cloud-run-の構築とログイン不能バグの修正) |
| マスタ機能の設計 | 6 | [削除機能](history/2026-08-w2.md#2026-08-08-マスタ削除機能の設計)・[コードと分類の変更](history/2026-08-w2.md#2026-08-08-マスタコードとマスタ分類の変更機能の設計)・[残り 4 項目と CSV](history/2026-08-w2.md#2026-08-09-マスタ設計の残り4項目を決着させcsvダウンロードを設計)（3 項目は不採用で決着 → 設計書 §00.9.1） |
| マスタ機能の製造（工程1〜18＋第5段階1〜4） | 22 | [製造開始](history/2026-08-w2.md#2026-08-09-マスタ機能の製造工程1を完了)・[単体テスト完了](history/2026-08-w2.md#2026-08-14-マスタ機能の単体テスト仕様書作成と画面操作テストを完了工程18-2〜18-10)・[CSVを同期方式へ作り直し](history/2026-08-w3.md#2026-08-16-マスタcsvをworker経由の非同期方式からapp内の同期方式へ作り直し)・[本番DB整理完了](history/2026-08-w3.md#2026-08-16-本番dbへdrop_master_exportマイグレーションを適用) |
| 一覧 UI の共通化 | 3 | [スクロールと固定ヘッダー](history/2026-08-w2.md#2026-08-10-一覧テーブルのスクロールと固定ヘッダーを共通化)・[検索条件アコーディオン](history/2026-08-w2.md#2026-08-10-検索条件アコーディオンと一覧規約を共通化)・[ヘッダーソート](history/2026-08-w2.md#2026-08-10-全一覧のヘッダーソートとマスタ初期分類を実装)（規約は [`DESIGN.md`](../../DESIGN.md)） |
| 宿題から片づけたもの | 4 | `onlyBuiltDependencies` の検証、`paths-ignore` の実機確認、Storage の疎通（PR #6）、GitHub Actions の更新（PR #2） |

関連ドキュメントの一覧は冒頭の[書き分け表](#todo)にある。
