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
| **workerサンプル一式（Cloud Run Jobs本番構成の構築7＋マスタ情報Excel取得機能9）** | **16 / 16** |
| **マスタ分類の見直し** | **4 / 4** |
| 残っているタスク（期限なしの宿題） | 未対応 9 件 |

土台は 2026-08-04 に本番稼働へ到達した。内訳は [完了済みの作業](#完了済みの作業)。

## 次にやること

**マスタ分類の見直し（全4項目）が完了し、[PR #21](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/21) が `main` へマージ済み**（2026-08-19）。実施内容・検証結果は [完了済みの作業](#完了済みの作業) の該当行から履歴をたどること。

**次は、本番への反映（2ステップ、いずれもユーザー主導）を行うこと。**

1. 本番 `DATABASE_URL` に対して `prisma migrate deploy`（3本のマイグレーションが未適用）
2. 本番 `DATABASE_URL` に対して `pnpm prisma:seed`（「契約先分類」「契約分類」の初期データ投入。他のUser/Announcementのupsertは対象データ既存のためno-opで安全）

**作業前に必ず確認すること。** ローカルの `.env` が一時的に本番Supabase（`DATABASE_URL`）を指す設定になっていることが2026-08-19に判明した（経緯・対処は [`docs/todo/notes/supabase.md`](notes/supabase.md#2026-08-19-envのdatabase_urlが本番を指したまま残っていた) を参照）。`pnpm dev` / `pnpm worker` / Prismaスクリプトを実行する前に、接続先がローカルであることを確認するか、`.env.local` でローカルDBへ上書きすること。**Prisma CLI（`prisma migrate` 系コマンド）は `.env.local` を読まない**（Next.jsのランタイムだけが優先読み込みする）ため、`DATABASE_URL=<ローカル接続文字列>` を明示的に指定してコマンドを実行すること。

手元の状態を確認するコマンド:

```powershell
git log --oneline -1                                     # 現在のコミット
git status --porcelain                                   # 未コミット差分がないか確認
```

## マスタ分類の見直し
- [x] **1. マスタ分類にユーザが入力できる分類コードを追加する**（2026-08-19）→ [履歴](history/2026-08-w3.md#2026-08-19-マスタ分類の見直しを実装工程1〜4)
- [x] **2. 「契約先分類」と「契約分類」をマスタ分類の初期データとして投入する**（2026-08-19）→ [履歴](history/2026-08-w3.md#2026-08-19-マスタ分類の見直しを実装工程1〜4)
- [x] **3. 契約先情報の分類を「契約先分類」に変更する**（2026-08-19）→ [履歴](history/2026-08-w3.md#2026-08-19-マスタ分類の見直しを実装工程1〜4)
- [x] **4. 契約情報に「契約分類」を追加する**（2026-08-19）→ [履歴](history/2026-08-w3.md#2026-08-19-マスタ分類の見直しを実装工程1〜4)

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
| 作業ブランチ | `feat/master-category-code`（マスタ分類の見直し。工程1〜4）が [PR #21](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/21) でマージ済み、リモート・ローカルとも削除済み。それ以外は特になし。`test/master-excel-export-unit-test` が [PR #20](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/20)（**レビュー待ち、未マージ**）。`feat/master-excel-export-model` が [PR #18](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/18)、`refactor/master-excel-drop-artificial-delay` が [PR #19](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/19)、`feat/master-csv-sync` が [PR #16](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/16)、`feat/worker-image` が [PR #15](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/15)、`feat/infra-cloud-run-jobs` が [PR #14](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/14)、`feat/master-management`（工程 1〜18）が [PR #13](https://github.com/koekoebaborak27/multi-ai-agent-sample/pull/13) でそれぞれマージ済み、リモート・ローカルとも削除済み |
| 本番 DB | `20260816192822_add_master_excel_export` まで**適用済み**（2026-08-18）。マスタ分類の見直し（工程1〜4）のマイグレーション3本は**ローカルのみ適用、本番は未反映**（次回、本番へ `prisma migrate deploy` と `pnpm prisma:seed` の実行が必要） |
| ローカル DB | Docker Compose の PostgreSQL 16 は**起動中**。マスタ分類は本来の3件に加え、契約先分類・契約分類とその配下のマスタ4件（検証用、`CORP`/`INDIV`/`GYOMU`/`HOSYU`）が入っている。契約先・契約にも検証用データが1件ずつ入っている |
| ローカル `.env` | **`DATABASE_URL` が本番Supabaseを指す設定になっている**（2026-08-19判明。経緯は [`docs/todo/notes/supabase.md`](notes/supabase.md#2026-08-19-envのdatabase_urlが本番を指したまま残っていた)）。ローカル作業は `.env.local`（Git管理外）で `DATABASE_URL` / `STORAGE_TYPE=local` / `WORKER_INVOKE_MODE=none` を上書きして行うこと。**Prisma CLI（`prisma migrate` 系）は `.env.local` を読まないため、`DATABASE_URL=<ローカル接続文字列>` を明示指定して実行する** |
| ブラウザ検証 | 工程 18（18-1〜18-10）でマスタ分類一覧・新規登録・詳細・更新・削除（MST-06〜10）とマスタ検索一覧・新規登録・詳細・更新・削除（MST-01〜05）を ADMIN/OPERATOR/VIEWER の各ロールで Playwright により実機確認済み。CSV同期方式への変更後は、ローカル・本番の両方でマスタ・マスタ分類双方のCSVダウンロードをブラウザで確認済み（待ち時間なし）。マスタ情報Excel取得（MST-11）はUT_30（2026-08-19）でローカルのPlaywright実機確認（全11ケース）を完了済み。マスタ分類の見直し（工程1〜4）は2026-08-19にローカルで手動のブラウザ確認済み（Playwright仕様書は未作成） |
| 直近の検証 | 2026-08-19、マスタ分類の見直し（工程1〜4）を実装し、`pnpm typecheck`/`test`（284件）/`lint`/`format:check` すべて成功。ローカルブラウザでマスタ分類一覧・新規登録・更新（コード入力・確認画面）、契約先・契約の新規登録（分類プルダウン・一覧表示）を確認済み |
| 本番 | **稼働中**（Cloud Run `contract-app` / us-central1、`https://contract-app-24516671242.us-central1.run.app`）。Cloud Run Jobs `contract-worker`（us-central1）は worker専用サービスアカウント `contract-worker-runner` で稼働（Secret Manager の `database-url` / `supabase-service-role-key` への参照権限のみ付与）。タスクのタイムアウトは900秒。Cloud Buildはapp・worker両方のイメージを自動でビルド・反映する設定済み。構成・設定値・URL は [`docs/specs/99_infra/`](../specs/99_infra/README.md) |
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
| workerサンプル一式（Cloud Run Jobs本番構成の構築7＋マスタ情報Excel取得機能9） | 16 | [Cloud Run Jobs構築開始](history/2026-08-w3.md#2026-08-15-アプリからworkerを呼び出す処理を実装)・[本番構成を仕上げ本番確認完了](history/2026-08-w3.md#2026-08-18-マスタ情報excel取得機能の本番構成を仕上げる)・[単体テスト完了](history/2026-08-w3.md#2026-08-19-マスタ情報excel取得機能の単体テスト仕様書作成と画面操作テストを完了工程9) |
| マスタ分類の見直し（工程1〜4） | 4 | [分類コード追加・契約先契約分類の参照を実装](history/2026-08-w3.md#2026-08-19-マスタ分類の見直しを実装工程1〜4)（未コミット・未PR、本番未反映） |
| 一覧 UI の共通化 | 3 | [スクロールと固定ヘッダー](history/2026-08-w2.md#2026-08-10-一覧テーブルのスクロールと固定ヘッダーを共通化)・[検索条件アコーディオン](history/2026-08-w2.md#2026-08-10-検索条件アコーディオンと一覧規約を共通化)・[ヘッダーソート](history/2026-08-w2.md#2026-08-10-全一覧のヘッダーソートとマスタ初期分類を実装)（規約は [`DESIGN.md`](../../DESIGN.md)） |
| 宿題から片づけたもの | 4 | `onlyBuiltDependencies` の検証、`paths-ignore` の実機確認、Storage の疎通（PR #6）、GitHub Actions の更新（PR #2） |

関連ドキュメントの一覧は冒頭の[書き分け表](#todo)にある。
