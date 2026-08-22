# TODO 補足資料

[`TODO.md`](../TODO.md) の作業項目から参照される補足事項。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

> **インフラ構築の手順の正本は [`docs/specs/99_infra/`](../../specs/99_infra/README.md) に移した。**
> 新規に本番環境を構築する場合はそちらを見ること。ここに残しているのは**このプロジェクトを構築したときの実測値と経緯**（手順書に載せきれない測定値・判断の背景・当時の応答内容）である。

## ファイルの分け方

**対象の分類ごとに 1 ファイル。** 時系列ではなく「何について調べたいか」で引けるようにするため。
節の見出しとアンカーは分割前から変えていないので、既存の参照リンクはファイル名だけを読み替えればよい。

| ファイル | 扱う範囲 |
|---|---|
| [`supabase.md`](supabase.md) | Supabase のプロジェクト作成から本番 DB の初期化、API キーの形式、ローカル `.env` の扱いまで。 |
| [`storage-signed-url.md`](storage-signed-url.md) | Supabase Storage の公開 URL から署名 URL への差し替え方針と、実機確認で判明した落とし穴。 |
| [`docker-image.md`](docker-image.md) | 本番イメージの軽量化（実測値つきの内訳）、worker の起動方法、未実施の standalone 化の論点。 |
| [`cloud-run.md`](cloud-run.md) | Cloud Run のサービス作成時の設定値、Cloud Build が落ちた 2 つの原因、本番の環境変数と確認手順。 |
| [`prisma-cli.md`](prisma-cli.md) | `prisma migrate dev` がエージェントの非対話シェルで使えない問題と、`prisma migrate diff` を使った代替手順。 |

## 全節の索引

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-01 | [Supabase プロジェクト作成画面の設定](supabase.md#supabase-プロジェクト作成画面の設定) | 作成時に選んだ値と理由（変更不可の項目あり） |
| 2026-08-01 | [Supabase 接続文字列の選び方](supabase.md#supabase-接続文字列の選び方) | 3 種類のうち Session pooler 以外は使えない |
| 2026-08-01 | [Connect ダイアログの歩き方](supabase.md#connect-ダイアログの歩き方) | UI が紛らわしいので歩き方を固定する |
| 2026-08-02 | [本番 DB への適用手順](supabase.md#本番-db-への適用手順) | PowerShell でのマイグレーション / seed 実行 |
| 2026-08-02 | [Supabase の API キー形式](supabase.md#supabase-の-api-キー形式) | 新形式キーは `apikey` ヘッダが要る |
| 2026-08-02 | [ローカルの .env に本番の値を置いてよいか](supabase.md#ローカルの-env-に本番の値を置いてよいか) | 変数ごとの判断基準と切り替え方 |
| 2026-08-19 | [.envのDATABASE_URLが本番を指したまま残っていた](supabase.md#2026-08-19-envのdatabase_urlが本番を指したまま残っていた) | 2026-08-02の方針違反を発見。`.env.local`での回避方法と、`.env`自体の要修正事項 |
| 2026-08-02 | [署名 URL への差し替え方針](storage-signed-url.md#署名-url-への差し替え方針) | 確定した API 仕様・インターフェース・実機確認の結果と落とし穴 |
| 2026-08-02 | [本番イメージから落としたもの](docker-image.md#本番イメージから落としたもの) | 実測値つきの内訳。効いた施策と効かなかった施策 |
| 2026-08-02 | [worker の起動コマンド](docker-image.md#worker-の起動コマンド) | 環境ごとの正しい起動方法と、`pnpm worker` が本番で使えない 2 つの理由 |
| 未実施 | [standalone 化の設計上の論点](docker-image.md#standalone-化の設計上の論点) | worker との衝突、5 つの落とし穴、ローカル検証手順 |
| 2026-08-04 | [Cloud Run のサービス作成画面](cloud-run.md#cloud-run-のサービス作成画面) | 画面ごとの設定値と、既定のままだと危ない項目 |
| 2026-08-04 | [Cloud Build が失敗する 2 つの原因](cloud-run.md#cloud-build-が失敗する-2-つの原因) | 権限不足とビルドコンテキスト。**初回は 2 回連続で落ちた** |
| 2026-08-04 | [本番の環境変数](cloud-run.md#本番の環境変数) | Cloud Run に設定する 9 個 |
| 2026-08-04 | [デプロイ後の確認](cloud-run.md#デプロイ後の確認) | 疎通コマンドと、自動デプロイの反映を判定する方法 |
| 2026-08-04 | [本番で動かさないもの](cloud-run.md#本番で動かさないもの) | ワーカー / ローカル用 DB |
| 2026-08-21 | [`prisma migrate dev` がエージェントの非対話シェルで使えない](prisma-cli.md#prisma-migrate-dev-がエージェントの非対話シェルで使えない) | `prisma migrate diff` + 手動フォルダ作成 + `migrate deploy` での代替手順 |
| 2026-08-22 | [ローカルのDocker全部入れ運用でnode_modulesが古いまま固定される](docker-image.md#2026-08-22-ローカルのdocker全部入れ運用でnode_modulesが古いまま固定される) | 匿名ボリュームの仕組みと`pnpm install`自動化による恒久対応 |
