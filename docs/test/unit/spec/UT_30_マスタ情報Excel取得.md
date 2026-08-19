# 単体テスト仕様書: マスタ情報Excel取得（MST-11）

## 1. テスト対象
- 対象機能: マスタ情報Excel取得（workerサンプル）
- 対象画面またはAPI: `/master/exports`（マスタ情報Excel取得画面）、`GET /api/master/exports/[exportId]/download`、`/master`（導線ボタンの配置確認のみ）
- 対象ファイル:
  - `src/app/(main)/master/exports/page.tsx`
  - `src/app/(main)/master/page.tsx`（導線ボタン `master/exports` へのリンク）
  - `src/app/api/master/exports/[exportId]/download/route.ts`
  - `src/modules/master/ui/master-excel-export-run-button.tsx`
  - `src/modules/master/ui/master-excel-export-table.tsx`
  - `src/modules/master/ui/master-excel-export-refresh.tsx`
  - `src/modules/master/actions.ts`（`requestMasterExcelExportAction`）
  - `src/modules/master/service.ts`（`requestExcelExport` / `listExcelExports` / `getExcelExportDownload`）
  - `src/modules/master/jobs.ts`（`runMasterExcelExport`。worker側の生成処理）
  - `src/modules/master/validation.ts`（`masterExcelExportListQuerySchema`）
  - `src/worker/index.ts`（常駐worker）
- 関連DBテーブル: `MasterExcelExport`（更新対象）、`Master` / `MasterCategory`（読み取りのみ）
- 関連設計書: [`docs/specs/02_basic-design/master/40_マスタ情報Excel取得.md`](../../../specs/02_basic-design/master/40_マスタ情報Excel取得.md)

## 2. 前提条件
- 実行環境: ローカル環境（`pnpm dev` で起動した検証用サーバー。本番URL・本番DBには接続しない）
- ローカルの常駐worker: `pnpm worker` を別ターミナルで起動しておく。ただしTC-003は意図的にworkerを停止した状態で行う（手順内に明記）
- ログインユーザー:
  - ADMIN（`.env.example` の `SEED_ADMIN_LOGIN_ID` / `SEED_ADMIN_PASSWORD`）: TC-001〜005、007〜011で使用
  - VIEWER（`SEED_VIEWER_LOGIN_ID` / `SEED_VIEWER_PASSWORD`）: TC-006（権限確認）で使用
- 権限: 本機能は実行・閲覧・ダウンロードのいずれもロールによる制限を行わない（設計書§40.4）
- 事前DB状態:
  - マスタ分類が1件以上登録済みで、その`id`が1〜9桁のいずれか（4桁ゼロ埋め表示時に先頭が「0」になる値。ローカルDBに既存投入済みのマスタ分類（2件、ページング確認用）で通常満たされる）
  - マスタコードが8文字ちょうど（英大文字・数字・ハイフン・アンダースコアの上限文字数）、マスタ内容が30文字ちょうどのマスタを1件、ADMINでのUI操作により新規登録しておく（TC-005用）
  - マスタ分類名が30文字ちょうどのマスタ分類を1件、ADMINでのUI操作により新規登録しておく（TC-005用）
  - `createdBy` / `updatedBy` が `null` の `Master` または `MasterCategory` を1件、直接DB操作で用意しておく（UI操作では必ず利用者IDが記録されるため作れない。`UT_12_マスタ詳細.md` TC-006と同じ準備方法）（TC-005用）
- 使用するテストデータ:
  - マスタ分類「文字数上限確認用分類（30文字ちょうどになるよう調整した名前）」
  - マスタ「コード8文字ちょうど・内容30文字ちょうど」のマスタ1件
  - `createdBy` / `updatedBy` が `null` の行1件

## 3. テスト観点
- 正常系: 依頼から受付済み表示、worker処理後の状態自動更新、ダウンロードとファイル内容の確認
- 異常系: 未完了履歴・存在しない履歴への直接アクセス、未ログインでのアクセス
- 境界値: マスタ分類コードの0始まりゼロ埋め表示、マスタコード8文字・マスタ内容/分類名30文字ちょうどの表示
- 権限: 全ロールが実行・他者の履歴閲覧・ダウンロードができる
- DB更新: `MasterExcelExport`の状態遷移（QUEUED→RUNNING→READY）
- 画面表示: 実行履歴0件時の表示、自動更新（10秒間隔）、導線ボタンの配置
- エビデンス取得: ダウンロードしたExcelファイルの中身、依頼・ダウンロードのログ記録

## 4. テストケース一覧

| No | 区分 | テストケース名 | 前提条件 | 操作手順 | 期待結果 | エビデンス |
|---|---|---|---|---|---|---|
| TC-001 | 画面表示 | 実行履歴0件時の表示 | `MasterExcelExport`にデータが1件も無い状態（ローカルDBは動作確認後にクリーンな状態へ戻す運用のため、通常0件のはず。0件でなければ本ケースの前にテスト用の行を除いて確認する）。ADMINでログイン済み。 | `/master/exports` を開く。 | 実行履歴一覧に「まだ実行履歴がありません」と表示される。「Excelを作成する」ボタンは表示され、活性状態である。 | 001_実行履歴0件表示.png |
| TC-002 | 正常系 | Excel作成の依頼と即時応答 | ADMINでログイン済み。`/master/exports` を開いた状態。 | 「Excelを作成する」ボタンをクリックする。 | クリック直後、ボタンが一時的に「受付中...」表示になり無効化される。応答後、実行履歴一覧の先頭に状態「受付済み」の行が即座に追加される（生成の完了を待たない）。件数列は「—」、ファイル列は「—」と表示される。 | 002_Excel作成依頼受付済み表示.png |
| TC-003 | 異常系 | 未完了（受付済み）履歴のダウンロードURL直接アクセス | `pnpm worker` を停止した状態で、TC-002の操作を行い「受付済み」のまま状態が進まない実行履歴を1件作る。そのURL（`/api/master/exports/{exportId}/download`）を控えておく。 | ブラウザーで `/api/master/exports/{exportId}/download`（受付済みのまま進んでいない履歴のID）を直接開く。 | HTTPステータス404が返り、応答本文が`{"error":{"code":"MASTER_EXCEL_EXPORT_NOT_FOUND",...}}`の形になる。ファイルはダウンロードされない。 | 003_未完了履歴への直接アクセス404.png |
| TC-004 | 正常系 | worker処理後の状態自動更新 | TC-003で作った「受付済み」の実行履歴が残っている状態。`pnpm worker` を起動する（TC-003で停止していたworkerを再開する）。 | `/master/exports` を開いたまま、画面を操作せずに最大10秒待つ（自動更新を待つ）。状態が変わらない場合は「最新の状態にする」ボタンをクリックする。 | 対象行の状態が「受付済み」→「作成中」→「完了」の順に、画面を再読み込みしなくても自動的に更新される。完了後、件数列に「分類N件 / マスタM件」の形で件数が表示され、実行者列に依頼したADMINの表示名が表示され、ファイル列に「ダウンロード」ボタンが表示される。 | 004_worker処理後の状態自動更新.png |
| TC-005 | 正常系/境界値 | ダウンロードしたExcelファイルの中身確認 | TC-004で完了した実行履歴が存在する。事前DB状態に記載した境界値データ（マスタコード8文字ちょうど・マスタ内容30文字ちょうどのマスタ、分類名30文字ちょうどの分類、`createdBy`/`updatedBy`が`null`の行）が登録済み。 | TC-004で完了した行の「ダウンロード」ボタンをクリックする。ダウンロードされたファイルを開く。 | ファイル名が`master_info_YYYYMMDDHHmmss.xlsx`の形（ASCII文字のみ）でダウンロードされる。ファイルに「マスタ分類」「マスタ」の順で2シートある。「マスタ分類」シートの見出し行が「マスタ分類コード、マスタ分類名、登録マスタ件数、登録日時、登録者、最終更新日時、最終更新者」の7列、「マスタ」シートの見出し行が「マスタ分類コード、マスタ分類名、マスタID、マスタコード、マスタ内容、登録日時、登録者、最終更新日時、最終更新者」の9列である。マスタ分類コード列が`MasterCategory.id`を4桁ゼロ埋めした値（例: IDが1〜9の分類は「0001」〜「0009」のように先頭が0で始まる）になっている。マスタコード8文字ちょうど・マスタ内容30文字ちょうどのテストデータの行が、途中で切れずに全文表示されている。マスタ分類名30文字ちょうどのテストデータも同様に全文表示されている。`createdBy`または`updatedBy`が`null`の行は、対応する「登録者」または「最終更新者」のセルが空欄になっている（他の文字列（例: "null"や"undefined"）が入らない）。データ行の件数がTC-004の件数表示と一致する。 | 005_Excelファイル中身確認.png、ダウンロードしたxlsxファイル |
| TC-006 | 権限 | VIEWERロールでの実行・他者履歴の閲覧・ダウンロード | ADMINが作った完了済みの実行履歴（TC-004またはTC-005のもの）が存在する。VIEWERでログイン済み。 | VIEWERで `/master/exports` を開く。ADMINが作った履歴の行を確認する。「Excelを作成する」ボタンをクリックする。応答後、ADMINが作った履歴の「ダウンロード」ボタンをクリックする。 | VIEWERでもADMINが作った履歴（実行者列にADMINの表示名。表示名が未設定の場合はログインID）が一覧に表示される。VIEWERでも「Excelを作成する」ボタンが活性で、クリックすると受付済みの行が追加される（拒否されない）。ADMINが作った履歴の「ダウンロード」ボタンもクリックでき、拒否されずにファイルがダウンロードされる。 | 006_VIEWERロールでの実行と他者履歴ダウンロード.png |
| TC-007 | 画面表示 | マスタ管理画面からの導線ボタン | ADMINでログイン済み。 | `/master` を開く。画面見出し「マスタ管理」の右側を確認する。「マスタ管理情報Excel作成」ボタンをクリックする。 | 見出しの右側に、左から「マスタ管理情報Excel作成」「マスタ分類の管理」の順でボタンが並んでいる。「マスタ管理情報Excel作成」ボタンをクリックすると `/master/exports` へ遷移する。 | 007_マスタ管理画面の導線ボタン.png |
| TC-008 | 異常系 | 未ログインで画面へ直接アクセス | ログアウト状態。 | ブラウザーで `/master/exports` を直接開く。 | `/login` へリダイレクトされる。実行履歴一覧は表示されない。 | 008_未ログイン画面アクセス.png |
| TC-009 | 異常系 | 未ログインでダウンロードURLへ直接アクセス | ログアウト状態。TC-004またはTC-005で完了済みの実行履歴のIDを控えておく。 | ブラウザーで `/api/master/exports/{exportId}/download`（完了済みの履歴ID）を直接開く。 | HTTPステータス401が返り、応答本文が`{"error":{"code":"UNAUTHORIZED",...}}`の形になる（`/api`はmiddlewareの認証ガード対象外のため、ログイン画面へのリダイレクトではなくRoute Handlerが直接エラー応答を返す）。ファイルはダウンロードされない。 | 009_未ログインダウンロードアクセス.png |
| TC-010 | 異常系 | 存在しない実行履歴IDへのアクセス | ADMINでログイン済み。 | ブラウザーで `/api/master/exports/not-exist-id-xxxxx/download`（存在しないID）を直接開く。 | HTTPステータス404が返り、応答本文が`{"error":{"code":"MASTER_EXCEL_EXPORT_NOT_FOUND",...}}`の形になる。 | 010_存在しない履歴IDアクセス.png |
| TC-011 | エビデンス取得 | 依頼・ダウンロードのログ記録 | TC-002の操作とTC-005の操作を行う直前から `pnpm dev` のコンソール出力を確認できる状態にしておく。 | TC-002（Excel作成の依頼）とTC-005（ダウンロード）の操作を再度実行する。 | `pnpm dev` のコンソールに、依頼時は`✓ master.excel-export.request`、ダウンロード時は`✓ master.excel-export.download`を含むログ行がそれぞれ出力され、`userId`と`role`がログイン中のADMINユーザーの値と一致する。 | 011_依頼ダウンロードログ記録.txt（コンソール出力の該当行を転記） |

## 5. DB確認内容

| No | テーブル | 条件 | カラム | 期待値 |
|---|---|---|---|---|
| TC-001 | 該当なし（DB変化なし） | - | - | - |
| TC-002 | `MasterExcelExport` | 依頼操作の直後に作られた行 | `status` / `requestedBy` / `filePath` / `fileName` | `status`が`"QUEUED"`。`requestedBy`がADMINの`User.id`と一致。`filePath`・`fileName`はいずれも`null`。 |
| TC-003 | `MasterExcelExport` | TC-002で作った行（workerが処理していない） | `status` | `"QUEUED"`のまま変化していない。 |
| TC-004 | `MasterExcelExport` | TC-002で作った行（worker処理後） | `status` / `startedAt` / `finishedAt` / `categoryRowCount` / `masterRowCount` / `filePath` / `fileName` / `expiresAt` | `status`が`"READY"`。`startedAt`・`finishedAt`がいずれも設定されている。`categoryRowCount`・`masterRowCount`がそれぞれ実際の登録件数と一致。`filePath`・`fileName`が設定されている。`expiresAt`が`finishedAt`の7日後になっている。 |
| TC-005 | 該当なし（DB変化なし。ダウンロードは読み取りのみ） | - | - | - |
| TC-006 | `MasterExcelExport` | VIEWERの依頼操作で作られた行 | `status` / `requestedBy` | `status`が`"QUEUED"`。`requestedBy`がVIEWERの`User.id`と一致（他ロールでも依頼できることの確認）。 |
| TC-007 | 該当なし（DB変化なし） | - | - | - |
| TC-008 | 該当なし（DB変化なし） | - | - | - |
| TC-009 | 該当なし（DB変化なし） | - | - | - |
| TC-010 | 該当なし（DB変化なし） | - | - | - |
| TC-011 | 該当なし（DB変化なし。ログ記録のみ確認） | - | - | - |

## 6. 未確定事項
- 無し（作成前に確認した不明点は「7. 補足」に記録した）

## 7. 補足
- 件数上限（`MASTER_EXCEL_EXPORT_MAX_ROWS` = 10,000件）超過時の`MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED`は、10,000件超のテストデータ投入が現実的でないため、`UT_10_マスタ検索一覧.md`・`UT_15_マスタCSVダウンロード.md`と同じ理由で本仕様書の対象外とした。
- マスタ内容・マスタコード・マスタ分類名は、DB上`NOT NULL`かつ入力チェックで「1文字以上必須（空白のみ不可）」のため、画面操作では空文字（ブランク）のデータを作成できない。この境界値は対象外とした（ユーザー確認済み）。
- Excelの列の書式（日時形式・見出し行の装飾・固定・オートフィルター・縞模様）の詳細は`src/modules/master/excel-export.test.ts`（Vitest）で担保済みのため、本仕様書のTC-005ではシート構成・列・件数・境界値（0始まりコード・NULL項目の空欄・最大文字数）の確認に留める。
- worker側の状態遷移の内部ロジック・冪等性（同じ依頼を2回処理しても二重生成されない）・保持期限切れファイルの掃除処理は`src/modules/master/jobs.test.ts`（Vitest）で担保済みのため、本仕様書では画面に表れる結果（状態表示・ダウンロード可否）だけを確認する。
- 生成失敗（`FAILED`状態）は、意図的にストレージ書き込みなどを失敗させる手段が無く画面操作で再現できないため、本仕様書の対象外とした。`src/modules/master/jobs.test.ts`の「途中で失敗した場合、状態を失敗にして例外を投げ直す」で担保済み。
- 保持期限切れ（作成から7日経過）のダウンロード拒否（`MASTER_EXCEL_EXPORT_EXPIRED`）は、実際に7日待つかDBの`expiresAt`を直接書き換える必要があり、本仕様書のテスト実行時間内での再現が難しいため対象外とした。
- テスト観点チェックリストのうち、以下は本機能の性質上対象外とした。
  - 重複・DB制約違反: 本機能は出力専用の読み取り処理（依頼の登録を除く）であり、一意制約に触れる操作を持たないため対象外。
  - 未入力: 本機能の操作画面（`/master/exports`）に入力フォームは無く（ボタン押下のみ）、対象外。
  - 権限不足: 設計書§40.4のとおり、実行・閲覧・ダウンロードのいずれも全ロールが許可されており、権限不足で拒否される操作が無いため対象外（TC-006で全ロール許可されることは確認する）。
  - ページングの並び替え・件数境界: 一覧のページング自体の挙動は他の一覧画面（`UT_10_マスタ検索一覧.md`等）で共通のUIとして確認済みのため対象外。
