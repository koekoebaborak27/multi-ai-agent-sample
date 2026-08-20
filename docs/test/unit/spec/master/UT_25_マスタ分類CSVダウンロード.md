# 単体テスト仕様書: マスタ分類CSVダウンロード（MST-06起点）

## 1. テスト対象
- 対象機能: マスタ分類CSVダウンロード（マスタ分類一覧 MST-06 起点）
- 対象画面またはAPI: `/master/categories`（マスタ分類一覧画面）の「CSVダウンロード」ボタン、`GET /api/master/categories/exports/csv`
- 対象ファイル:
  - `src/modules/master/ui/master-export-button.tsx`
  - `src/app/(main)/master/categories/page.tsx`（`exportDisabled` 等の組み立て）
  - `src/app/api/master/categories/exports/csv/route.ts`
  - `src/modules/master/service.ts`（`exportCategoryCsv`）
  - `src/modules/master/export.ts`（`buildMasterCategoryExportCsv` / `buildMasterExportFileName`）
  - `src/shared/observability/with-route.ts`（実行者情報のログ記録）
- 関連DBテーブル: `MasterCategory`（読み取りのみ。更新は行わない）
- 関連設計書: [`docs/specs/02_basic-design/master/30_CSVダウンロード.md`](../../../specs/02_basic-design/master/30_CSVダウンロード.md)（§30.1）

## 2. 前提条件
- 実行環境: ローカル環境（`pnpm dev` で起動した検証用サーバー。本番URL・本番DBには接続しない）
- ログインユーザー: VIEWERロールのユーザー（ロールによる制限が無いことを確認する目的で使用する。`.env.example` の `SEED_VIEWER_LOGIN_ID` / `SEED_VIEWER_PASSWORD` に対応するアカウントを使う。ローカルDBに未投入の場合は投入する）
- 権限: 本機能はロールによる制限を行わない（設計書§30.1.5 手順1「ロールによる制限は行わない」）。未ログインの場合は`UNAUTHORIZED`になる。
- 事前DB状態: `MasterCategory` が2件以上登録済みで、いずれかに1件以上のマスタが紐づいている（登録マスタ件数の列を確認できること）。
- 使用するテストデータ: `MasterCategory` 2件以上（うち1件はマスタが紐づく分類）

## 3. テスト観点
- 正常系: マスタ分類全件のCSVダウンロード（本画面は検索条件を持たないため、常に全件が対象）
- 異常系: 未ログインでURLを直接開いた場合の`UNAUTHORIZED`
- 境界値: 対象外（理由は「7. 補足」）
- 権限: VIEWERロールでもダウンロードできる（ロールによる制限が無いことの確認）
- DB更新: なし
- 画面表示: ボタン押下から待機表示なくダウンロードが始まること
- エビデンス取得: ダウンロードされたCSVファイルのヘッダー行・BOM・件数、アプリケーションログの記録内容

## 4. テストケース一覧

| No | 区分 | テストケース名 | 前提条件 | 操作手順 | 期待結果 | エビデンス |
|---|---|---|---|---|---|---|
| TC-001 | 正常系/権限 | 全件CSVダウンロード（VIEWERロール） | `MasterCategory` が2件以上登録済み。VIEWERロールのユーザーでログイン済み。 | `/master/categories` を開く。「CSVダウンロード」ボタンをクリックする。 | クリック後、待機表示なくファイル `master_categories_YYYYMMDDHHmmss.csv`（14桁の日時）がダウンロードされる。ダウンロードしたファイルの先頭にBOM（U+FEFF）が付いている。ヘッダー行が「マスタ分類コード,マスタ分類名,登録マスタ件数,登録日時,登録者,最終更新日時,最終更新者」の順で並ぶ。データ行の件数が画面の総件数と一致する。VIEWERロールでもボタンが非活性にならず、ダウンロードが拒否されない。 | 001_CSVダウンロード全件_VIEWER.png、ダウンロードしたCSVファイル |
| TC-002 | 異常系 | 未ログインでURLを直接開く | ログアウト状態。 | ブラウザーで `/api/master/categories/exports/csv` を直接開く。 | HTTPステータス401が返り、応答本文が `{"error":{"code":"UNAUTHORIZED",...}}` の形になる（`/api` はmiddlewareの認証ガード対象外のため、ログイン画面へのリダイレクトではなくRoute Handlerが直接エラー応答を返す）。CSVはダウンロードされない。 | 002_未ログインアクセス.png |
| TC-003 | 画面表示/エビデンス取得 | 実行者情報のログ記録 | TC-001の操作を行う直前から `pnpm dev` のコンソール出力を確認できる状態にしておく。 | TC-001の操作（CSVダウンロード）を実行する。 | `pnpm dev` のコンソールに `✓ master.category.export.csv` を含むログ行が出力され、`userId` と `role`（`VIEWER`）がログイン中のVIEWERユーザーの値と一致する。 | 003_CSVダウンロードログ記録.txt（コンソール出力の該当行を転記） |

## 5. DB確認内容

本機能は `MasterCategory` テーブルを読み取るだけで、更新・追加・削除は行わない。全テストケースでDB変化はない。

| No | テーブル | 条件 | カラム | 期待値 |
|---|---|---|---|---|
| TC-001〜TC-003 | 該当なし（DB変化なし） | - | - | - |

## 6. 未確定事項
- 無し

## 7. 補足
- ボタンの活性・非活性制御と非活性理由の表示は [`UT_20_マスタ分類一覧.md`](UT_20_マスタ分類一覧.md)（TC-008）で確認済みのため、本仕様書では対象外とする。
- 件数上限（`MASTER_EXPORT_MAX_ROWS` = 10,000件）超過時の `MASTER_EXPORT_LIMIT_EXCEEDED` は、10,000件超のテストデータ投入が現実的でないため、[`UT_20_マスタ分類一覧.md`](UT_20_マスタ分類一覧.md)と同じ理由で本仕様書の対象外とした。
- CSVの列の書式（日時形式・null時の空欄・BOM・CRLF・引用符のエスケープ）は `src/modules/master/export.test.ts`（Vitest）で担保済みのため、本仕様書のTC-001ではヘッダー行と件数の確認に留める。
- 本画面は検索条件を持たず常に全件が対象のため、検索条件を指定したCSVダウンロードのテストケースは無い（[`UT_15_マスタCSVダウンロード.md`](UT_15_マスタCSVダウンロード.md)のTC-002に相当するケースは存在しない）。
- テスト観点チェックリストのうち、以下は本機能の性質上対象外とした。
  - 最大文字数・重複・存在しないID・DB制約違反・未入力: 本機能は出力専用の読み取り処理であり、検索条件も登録・更新操作も持たないため対象外。
