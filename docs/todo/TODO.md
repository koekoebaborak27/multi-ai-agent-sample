# TODO

汎用契約管理システムテンプレートへの作り替え（[`foundation_plan.md`](../foundation_plan.md)）の残作業一覧。

> **2026-08-04 に本番稼働へ到達した。期限のある残作業はゼロ。** Cloud Run 上で動作しており、ログイン → パスワード変更 → 契約先 / 契約の登録まで実機で確認済み。`main` への push を契機に自動デプロイされることも確認した。
>
> 以降は [積み残しと検討事項](#積み残しと検討事項)（期限のない宿題）から選んで進める。
>
> 番号（`残作業1`〜`残作業3`）は順序を確定したときのまま据え置いている（履歴からのリンクを壊さないため）。3 つとも完了し [完了済みの作業](#完了済みの作業) へ移動した。`残作業2` は当初「standalone 化」だったが 2026-08-02 に「Docker イメージの軽量化」へ差し替えており、standalone 化は積み残しへ降格している。

## 目次

| 節 | 内容 |
|---|---|
| [進捗サマリ](#進捗サマリ) | 区分ごとの残数 |
| [作業の順序](#作業の順序) | 残作業をこの順に並べた理由と、2026-08-02 の見直し |
| [次にやること](#次にやること) | 次のセッションが最初に打つ手 |
| [補足資料](#補足資料) | 設定値・手順・落とし穴（別ファイル） |
| [積み残しと検討事項](#積み残しと検討事項) | 期限のない宿題 |
| [完了済みの作業](#完了済みの作業) | 実施履歴（折りたたみ） |
| [現在の状態](#現在の状態) | 事実の一覧 |
| [関連ドキュメント](#関連ドキュメント) | 補足 / 履歴 / 手順の正本 |
| [ホスティング先の選定経緯](#ホスティング先の選定経緯) | Cloud Run を選んだ理由 |

**別ファイル**（`docs/todo/` に同居）:

| ファイル | 内容 |
|---|---|
| [`TODO_補足.md`](TODO_補足.md) | 設定値・手順・落とし穴の詳細。**時系列順**に並べてあり、上から読めば構築をなぞれる |
| [`TODO_履歴.md`](TODO_履歴.md) | セッションごとの作業記録（旧「引き継ぎメモ」）。**古いセッションほど上**（時系列順）。新しい記録は末尾に足す |

## 進捗サマリ

| 区分 | 進捗 | 状況 |
|---|---|---|
| ローカル環境 | 10 / 10 | 完了。VSCode でのステップイン実行に対応（PR #10） |
| Git と GitHub | 13 / 13 | 完了 |
| Supabase（本番 DB / Storage） | 6 / 6 | 完了。実機で読み書きまで確認済み |
| 1. 署名 URL 化 | 5 / 5 | 完了（PR #7）。本番バケットで実機確認済み |
| 2. Docker イメージの軽量化 | 6 / 6 | 完了（PR #8 / #9）。1.73GB → 1.31GB。**standalone 化からの差し替え** |
| **3. Google Cloud Run** | **8 / 8** | **完了（2026-08-04）。本番稼働中。過程で既存バグ 1 件を発見し PR #11 で修正** |
| 積み残しと検討事項 | 4 / 10 | 未対応 6 件（期限なし。2026-08-04 に 2 件追加） |

## 作業の順序

2026-08-02 に**「署名 URL 化 → standalone 化 → Cloud Run 構築」の順**で確定したが、**同日中に 2 番目を「Docker イメージの軽量化」へ差し替えた**。経緯は [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)。

| # | 作業 | 種別 | 結果 |
|---|---|---|---|
| 1 | 署名 URL 化（**完了** → [完了済みの作業](#完了済みの作業)） | コード | **いま安く、あとで高くなる**。`getPublicUrl` の呼び出し元がゼロのうちに変えられた。実際に変更は 5 ファイルで閉じ、この読みは当たった |
| 2 | Docker イメージの軽量化（**完了** → [完了済みの作業](#完了済みの作業)） | Docker | 当初は standalone 化を置いていたが、**より安く同等の効果が出る施策へ差し替えた**（下記） |
| 3 | Cloud Run 構築（**完了** → [完了済みの作業](#完了済みの作業)） | ブラウザ | **人の手が要る作業を最後に置く**。この読みは当たり、コード側の準備は一切やり直さずに済んだ。ただし**本番でしか露見しないバグを 1 件踏んだ**（→ [完了済みの作業](#完了済みの作業)） |

### なぜ standalone 化を差し替えたか

当初 `残作業2` は「standalone 化」で、理由は「コールドスタート対策」だった。**この根拠が弱いことが分かったため差し替えた。**

| 論点 | 分かったこと |
|---|---|
| コールドスタートへの効果 | `output: "standalone"` が縮めるのは**イメージ取得時間だけ**で、Node 起動 → Next 初期化 → Prisma 初期化という**起動処理そのものは 1 ミリ秒も縮まない**。「十数秒なら許容」という前提なら、やっても十数秒のまま |
| コスト | worker が standalone 出力に含まれないため、**本番イメージの構成を決める設計判断とセット**になる。現時点で worker は登録ジョブがゼロで、決める材料が揃っていない |
| 代替の存在 | **worker と一切衝突しない施策**（devDependencies 除去・musl バイナリ除去・起動コマンド直結）だけで 1.73GB → 1.31GB（-24%）を達成できた |
| 順序のリスク | standalone を先にやると、Cloud Run 初回デプロイで「Cloud Run の設定ミス」と「standalone の落とし穴」が**同時に初見**になる。逆順なら動くベースラインを先に確保でき、リビジョン切り戻しも 1 クリック |

**standalone 化は [積み残しと検討事項](#積み残しと検討事項) へ降格した。** 着手の適時は「worker に実ジョブ（CSV 取り込み等）を載せ、worker 用イメージを `runner` から分離するとき」。イメージを分ければ app 側は worker を気にせず standalone にでき、[案 B](TODO_補足.md#standalone-化の設計上の論点) がそのまま成立する。

## 次にやること

**期限のある残作業は無い。** テンプレートの土台は本番稼働まで到達した。次のセッションは [積み残しと検討事項](#積み残しと検討事項) から選ぶか、`src/modules/` へ案件固有の業務ドメインを足す段階へ進む。

積み残しから着手するなら、次の順で価値が高い。

| 優先 | 項目 | 理由 |
|---|---|---|
| 1 | Cloud Run の実行サービス アカウントを絞る | **本番が動いている今も、コンテナがプロジェクトの編集者権限を持ったまま**。リビジョン編集で差し替えるだけなので安い |
| 2 | `main` のブランチ保護 | 自動デプロイが動き出したため、`main` への誤 push が**そのまま本番へ出る**ようになった。判断の重みが増している |
| 3 | `output: "standalone"` 化 | 単独では価値が低い。worker 用イメージを分離するときに併せて行う |

手元の状態を確認するコマンドは次のとおり。

```powershell
git log --oneline -1                                     # main = a8181bd
git status --porcelain                                   # 何も出なければクリーン
docker compose -f docker/docker-compose.yml up -d db     # ローカル開発を再開する場合
```

本番が生きているかは、ブラウザを開かずに確認できる（URL は Cloud Run コンソールの「サービスの詳細」に表示される）。

```powershell
$base="https://contract-app-<プロジェクト番号>.us-central1.run.app"
Invoke-WebRequest "$base/api/health?check=db" -UseBasicParsing   # {"data":{"status":"ok","db":"up"}}
```

**2026-08-04 以降、`main` への push は本番デプロイを引き起こす。** `main` が更新されると Cloud Build が起動して Cloud Run へ反映される。`.md` だけの変更は GitHub Actions の CI こそ動かないが、**Cloud Build は別の仕組みなので走る**（→ [積み残しと検討事項](#積み残しと検討事項)）。

なお**コード**を変更する場合は `main` へ直接 push せず **feature ブランチ → PR → CI green → squash マージ**に従う（コマンドは [`TODO_履歴.md`](TODO_履歴.md#2026-08-02-pr-運用の開始と-ci-の順序バグ修正) の「PR 運用の型が固まった」）。**`.md` / `docs/` 配下だけの変更**は `paths-ignore` により CI が動かないため `main` へ直接 push してよい（手順は [`README.md`](../../README.md) の「ドキュメントだけの変更でCIを実行しない」）。

各セッションの終わりには、エージェントに「TODO を更新して」（または `/update-todo`）と伝えてこのファイルを更新する。手順は [`docs/skills/update-todo.md`](../skills/update-todo.md)。

## 補足資料

設定値・手順・落とし穴の詳細は、本編を読みやすく保つため [`TODO_補足.md`](TODO_補足.md) に分離している。**作業の時系列順**に並んでいる。

| 時期 | 節 | 主な内容 |
|---|---|---|
| 2026-08-01 | [Supabase プロジェクト作成画面の設定](TODO_補足.md#supabase-プロジェクト作成画面の設定) | Data API オフ / リージョン（**作成後は変更不可**）など、作成時の選択と理由 |
| 2026-08-01 | [Supabase 接続文字列の選び方](TODO_補足.md#supabase-接続文字列の選び方) | 3 種類のうち **Session pooler 以外は使えない**理由 |
| 2026-08-01 | [Connect ダイアログの歩き方](TODO_補足.md#connect-ダイアログの歩き方) | 使うタブは 1 つだけ。Session pooler の見分け方 |
| 2026-08-02 | [本番 DB への適用手順](TODO_補足.md#本番-db-への適用手順) | `migrate deploy` / seed を PowerShell で実行する 6 手順 |
| 2026-08-02 | [Supabase の API キー形式](TODO_補足.md#supabase-の-api-キー形式) | 新形式キーには `apikey` ヘッダが要る。疎通確認コマンド |
| 2026-08-02 | [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか) | 変数ごとの可否と、本番ストレージへの切り替え方 |
| 2026-08-02 | [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針) | 確定した API 仕様・インターフェース・実機確認の結果と落とし穴 |
| 2026-08-02 | [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの) | 実測値つきの内訳。効いた施策と効かなかった施策 |
| 2026-08-02 | [worker の起動コマンド](TODO_補足.md#worker-の起動コマンド) | 環境ごとの正しい起動方法。`pnpm worker` が本番で使えない 2 つの理由 |
| 未実施 | [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) | worker との衝突、ローカルでの検証コマンド。**着手条件が変わった** |
| 2026-08-04 | [Cloud Run のサービス作成画面](TODO_補足.md#cloud-run-のサービス作成画面) | 画面ごとの設定値。**既定のままだと危ない項目**（リージョン / 最大インスタンス数） |
| 2026-08-04 | [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因) | 権限不足とビルドコンテキスト。**初回は 2 回連続で落ちた** |
| 2026-08-04 | [本番の環境変数](TODO_補足.md#本番の環境変数) | Cloud Run に設定する 9 個 |
| 2026-08-04 | [デプロイ後の確認](TODO_補足.md#デプロイ後の確認) | 疎通コマンドと、自動デプロイの反映を判定する方法 |
| 2026-08-04 | [本番で動かさないもの](TODO_補足.md#本番で動かさないもの) | pg-boss ワーカー / ローカル用 `db` サービス |

## 積み残しと検討事項

### 未対応

> **2026-08-02 に 2 件がここから昇格し、うち 1 件が戻ってきた。** 「`getPublicUrl` の署名 URL 化」は昇格して**完了**（[完了済みの作業](#完了済みの作業)）。「`output: "standalone"` 化」は一度 `残作業2` へ昇格したが、**同日ここへ差し戻した**（理由は [なぜ standalone 化を差し替えたか](#なぜ-standalone-化を差し替えたか)）。
>
> **2026-08-04 に 2 件を追加した**（Cloud Run 構築で判明した宿題）。いずれも本番が動いている状態で残っているものなので、優先度は [次にやること](#次にやること) を参照。

- [ ] **Cloud Run の実行サービス アカウントを、権限を持たない専用 SA に差し替える**（2026-08-04 追加）。現在は既定の `<プロジェクト番号>-compute@developer.gserviceaccount.com` を使っており、**プロジェクトの編集者権限を持ったまま本番が動いている**
  - このアプリは Google Cloud の API を一切呼ばない（DB もストレージも Supabase を直接叩く）ため、**権限ゼロの SA で動くはず**。[`docker/Dockerfile`](../../docker/Dockerfile) で非 root 実行までしている方針とも整合しない
  - サービス アカウントは**リビジョン編集で差し替え可能**（リージョンやサービス名と違い、やり直しが効く）。「新しいリビジョンの編集とデプロイ」→「セキュリティ」タブ
  - 差し替え後は `/api/health?check=db` とログインまで通し、本当に権限が不要であることを確認する
- [ ] **ドキュメントのみの変更で Cloud Build を走らせない仕組みを入れるか決める**（2026-08-04 追加）。GitHub Actions 側の `paths-ignore` は **Cloud Build には効かない**ため、`.md` の修正のたびに 5〜10 分のビルドと Cloud Run のリビジョン作成が発生する
  - 選択肢: ①放置（Always Free の範囲なら実害なし。現状はこれ） ②コミットメッセージに `[skip ci]` を付ける（Cloud Build も同じ文字列に対応） ③トリガーの「含まれるファイルと無視されるファイルのフィルタ」で `**.md` / `docs/**` を除外する
  - ③が仕組みとして確実だが、**トリガー設定は Git 管理外**なので、リポジトリを clone しただけでは再現しない（テンプレートとして配る際は手順書が要る）
- [ ] **`output: "standalone"` 化を検討する**（2026-08-02 に `残作業2` からここへ差し戻し）。**着手の適時は「worker 用イメージを `runner` から分離するとき」**。イメージを分ければ app 側は worker を気にせず standalone にでき、[案 B](TODO_補足.md#standalone-化の設計上の論点) が成立する
  - 単独でやる価値は低い。コールドスタートの**起動処理そのものは縮まない**うえ、[軽量化 PR](#完了済みの作業) で 1.73GB → 1.31GB を worker と衝突せずに達成済み
  - 着手する場合の論点・落とし穴 5 つ・ローカル検証コマンドは [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) に整理済み
  - 併せて [`next.config.ts`](../../next.config.ts) の既存コメント（「`next start` と併用不可のため設定しない」）も解消する
- [ ] `/update-todo` が GitHub Copilot Chat（`chat.promptFiles` が有効なこと）で実際に起動するか確認する。**Claude Code は 2026-08-02 のセッションで `/update-todo` の起動と正本（`docs/skills/update-todo.md`）の読み込みを確認済み**。Codex は `codex debug prompt-input` で検出済み
- [ ] マイグレーションの自動化を検討する（当面はローカルからの手動 `prisma migrate deploy`。Cloud Run には Railway の Pre-Deploy Command に相当する仕組みがないため、自動化するなら Cloud Run Jobs か Cloud Build のデプロイ後ステップになる）
- [ ] **`main` のブランチ保護をどうするか決める**（当面は「運用ルールとして守る」で保留）。private リポジトリのブランチ保護は **GitHub Pro（$4/月）か public 化が必要**で、2026-08-02 時点では未設定
  - 確認方法と実際の応答:

    ```powershell
    gh api repos/koekoebaborak27/multi-ai-agent-sample/branches/main/protection
    # → Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
    ```

  - つまり現状は **CI が赤でも `Merge pull request` を押せてしまう**し、`main` への直接 push も止まらない。[`AGENTS.md`](../../AGENTS.md) の「`main` 保護 + feature ブランチ → PR」は**仕組みで強制されておらず、運用ルールとして守っている**状態
  - 選択肢: ①このまま運用ルールで守る（無料・当面はこれ） ②テンプレートを public 化する（無料だが公開前提の内容精査が必要） ③GitHub Pro（$4/月）
  - 有効化する場合の設定箇所は Settings → Branches → Add branch protection rule で、**Require status checks to pass before merging** に `verify` を指定する

### 対応済み

<details>
<summary>完了した 4 件を開く</summary>

- [x] `package.json` の `pnpm.onlyBuiltDependencies`（Prisma 等のビルドスクリプト許可設定）が他の開発者環境・CI でも意図通り機能するか確認する（2026-08-01 の初回 CI で `pnpm install --frozen-lockfile` 以降が全ステップ成功したことで検証済み）。**ただし 2026-08-02 に判明したとおり、pnpm ストアがキャッシュヒットすると postinstall 自体が走らない**ため、postinstall による副作用（`prisma generate` 等）を前提にした構成にはしないこと
- [x] **`paths-ignore` が実際に CI をスキップすることを確認した**（2026-08-02）。TODO 更新コミット（`docs/todo/TODO.md` の 1 ファイルのみ・`[skip ci]` なし）を `main` へ push し、対応する run が作られないことを確認済み。以降、`.md` / `docs/` 配下だけの変更は `main` へ直接 push してよい

    ```powershell
    gh run list --limit 3   # → 直前の push に対応する行が現れなければ成功
    ```

- [x] `src/shared/storage/supabase.ts`（`@supabase/supabase-js` 非依存の REST API 実装）を実際の Supabase バケットに対して疎通確認する（2026-08-02 実施。**`apikey` ヘッダ不足で全操作が失敗するバグを発見し PR #6 で修正**。修正後は upload → download（内容一致）→ remove → 削除の反映まで通ることを実機で確認済み）
- [x] **GitHub Actions のバージョンを更新する**（PR #2 で実施・マージ済み）。`actions/checkout` v4→**v7** / `actions/setup-node` v4→**v7** / `pnpm/action-setup` v4→**v6**。Node.js 20 ターゲットの非推奨警告が消えたことを確認済み（アノテーション 0 件）
  - この Node.js は**アクション自身を動かす裏方の実行環境**であり、`.nvmrc`（アプリ側の Node = 22）とは無関係。`.nvmrc` を変えても警告は消えない
  - 破壊的変更はリリースノートで全て確認済み。本プロジェクトへの影響はなかった（checkout v7 の fork PR 制限は `pull_request_target` / `workflow_run` 限定、setup-node v5 の `packageManager` 自動キャッシュは v6 で npm 限定に戻され `cache: pnpm` 明示のため不変、pnpm/action-setup はバージョンを `packageManager` から解決）
  - **今後アクションを上げるときも同じ手順**: 各リポジトリの `.0.0` リリースノートを読む → 上げる → PR の CI で検証

</details>

## 完了済みの作業

<details>
<summary><b>ローカル環境</b> — 10 項目すべて完了</summary>

- [x] Docker Desktop を起動し、`docker compose -f docker/docker-compose.yml up -d db` で PostgreSQL を起動する
- [x] `pnpm prisma:migrate -- --name init` で初期マイグレーションを生成・適用する（`prisma/migrations/` は現状空。生成された `migration.sql` は目視レビューする）
- [x] `pnpm prisma:seed` で初期 ADMIN ユーザーを投入する
- [x] `pnpm dev` を起動し、`/login` で Credentials ログイン（初期 ID: `admin` / 初期PW: `Admin@123`、または `SEED_ADMIN_PASSWORD` で指定した値）→ ダッシュボード表示を確認する
- [x] `/admin/users` の表示・RBAC 制御（ADMIN 以外はリダイレクトされること）を確認する
- [x] `/parties` で契約先の新規登録・一覧表示・削除を確認する
- [x] `/contracts` で契約先を選択して契約の新規登録・一覧表示・削除を確認する（契約先が0件の場合は先に `/parties` で登録する）
- [x] 別ターミナルで `pnpm worker` を起動し、pg-boss ワーカーが待受状態になることを確認する
- [x] ローカル開発を Docker だけで完結できるようにする（`docker/Dockerfile` に `deps` から分岐する `dev` ステージを追加し `pnpm dev`/`tsx watch` で起動、`docker-compose.yml` はソースコードをバインドマウントして即時反映させる。既存の `build`/`runner` ステージは変更せず、`main` push時の本番ビルドには影響させない）
- [x] **VSCode からステップイン実行できるようにする**（2026-08-03 / PR #10）。`.vscode/launch.json` に 9 構成（`PC:` = VSCode が起動 / `Docker:` = 起動済みコンテナへ接続）。**実機でブレークポイント停止まで確認済み**（`/api/health`、ログインの Server Action → `authorize` → `verifyCredentials`）。操作手順は [`README.md`](../../README.md#vscodeでステップイン実行するデバッグ)、経緯と実測は [履歴](TODO_履歴.md#2026-08-03-vscode-デバッグ環境の整備)

</details>

<details>
<summary><b>Git と GitHub</b> — 13 項目すべて完了</summary>

- [x] GitHub アカウントを作成する（未作成の場合）
- [x] `git init -b main` でリポジトリを初期化する
- [x] コミット署名を個人アカウントに設定する（`git config --local`。グローバル設定＝会社アカウントは変更しない）
- [x] `git add -A` 後、`.env` / `node_modules/` / `.next/` / `.claude/settings.local.json` が含まれないことを目視確認する
- [x] `docs/legacy-contract-reference/` を Git 管理から除外する（実案件の AWS アカウント ID・許可 IP・ARN を含むため）
- [x] コミット前にローカルで CI 相当のチェックを通す（lint / format:check / typecheck / prisma validate / test / build）
- [x] 初回コミットを作成する
- [x] GitHub リポジトリを作成して push する（`koekoebaborak27/multi-ai-agent-sample`・private）
- [x] `.github/workflows/ci.yml`（GitHub Actions）が push で実際にグリーンになることを確認する（ローカルで未検証の `prisma migrate deploy` がここで初めて検証された。1m36s で success）
- [x] feature ブランチ → PR → CI の運用を開始する（PR #1 / ブランチ `docs/agent-skills-update-todo`。PR 契機でも CI が動くことを確認済み）
- [x] **PR #1 をマージする**（squash マージ・ブランチ削除まで完了。`main` = `849ee7a`）
- [x] PR 運用の手順を README に明文化する（PR #5 / `08d6409`。`gh` を使うコマンド版と GitHub サイト上での手作業版の両方、squash マージ後のローカル後片付けまで）
- [x] ドキュメントのみの変更で CI を起動しないようにする（`f365896`。[`ci.yml`](../../.github/workflows/ci.yml) に `paths-ignore`（`**.md` / `docs/**`）を追加し、README に手順を追記）

</details>

<details>
<summary><b>Supabase</b> — 6 項目すべて完了（本番 DB / Storage は使える状態）</summary>

- [x] Supabase アカウントを作成する（GitHub アカウントでのサインアップが手軽）
- [x] Supabase でプロジェクトを新規作成する（リージョン **East US (North Virginia)** で作成済み）。設定値は [プロジェクト作成画面の設定](TODO_補足.md#supabase-プロジェクト作成画面の設定) を参照
- [x] **Session pooler** の接続文字列を取得する（[接続文字列の選び方](TODO_補足.md#supabase-接続文字列の選び方) と [Connect ダイアログの歩き方](TODO_補足.md#connect-ダイアログの歩き方) を必ず読むこと）
- [x] ローカルから本番 DB へマイグレーションを適用する（2026-08-02 実施。`prisma migrate status` で `20260723125616_init` が未適用であることを確認 → `prisma migrate deploy` で適用完了）
- [x] ローカルから本番 DB へ初期 ADMIN を投入する（2026-08-02 実施。`SEED_ADMIN_PASSWORD` を指定して投入済み。**初回ログイン時に必ずパスワードを変更すること**。`mustChangePassword: true` で変更が強制される）
- [x] Supabase Storage のバケット `uploads` を **private** で作成（`.env.example` の `SUPABASE_STORAGE_BUCKET` と一致させる）し、Settings → API から `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` を取得する（2026-08-02 実施。バケットは API 応答で `"public":false` を確認済み。キーは新形式の `sb_secret_...` → [Supabase の API キー形式](TODO_補足.md#supabase-の-api-キー形式) を必ず読むこと）

</details>

<details>
<summary><b>1. 署名 URL 化</b> — 5 項目すべて完了（2026-08-02 / PR #7）</summary>

private バケットでは `getPublicUrl` が返す公開 URL が HTTP 400 で拒否されることを 2026-08-02 に実機確認したため、署名 URL の発行へ差し替えた。バケットを public にする案は、契約書類を扱う以上採らなかった。確定した仕様と落とし穴は [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)、経緯は [履歴](TODO_履歴.md#2026-08-02-署名-url-化)。

- [x] [`types.ts`](../../src/shared/storage/types.ts) の `StorageClient` を変更する（`getPublicUrl(path): string` → `getSignedUrl(path, expiresInSeconds?): Promise<string>`。既定値 `DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 60` も同ファイルに定義）
- [x] [`supabase.ts`](../../src/shared/storage/supabase.ts) を `/object/sign/` へ問い合わせる実装にする（`apikey` ヘッダの併送は既存実装を踏襲。応答の相対パスに `{SUPABASE_URL}/storage/v1` を前置する）
- [x] [`local.ts`](../../src/shared/storage/local.ts) を新しいインターフェースへ追随させる（従来どおり `/uploads/{path}` を返す。`async` 化のみ）
- [x] テストを追加し、**本番バケットに対して発行した署名 URL が実際に開けること**を実機確認する（テスト 19 → 26 件。実機では認証ヘッダなしの `fetch` で 200・内容一致、`expiresIn: 1` で 3 秒後に 400 `InvalidJWT` を確認。検証用オブジェクトは削除済み）
- [x] feature ブランチ → PR → CI green → squash マージ（PR #7 / `3e8487f`）。[`README.md`](../../README.md) の「ファイルストレージ」節も `getSignedUrl` の使い方へ更新した

</details>

<details>
<summary><b>2. Docker イメージの軽量化</b> — 6 項目すべて完了（2026-08-02 / PR #8・#9）</summary>

当初この枠は「standalone 化」だったが、**worker と衝突しない施策だけで同等の効果が出る**ことが分かったため差し替えた（→ [なぜ standalone 化を差し替えたか](#なぜ-standalone-化を差し替えたか)）。**1.73GB → 1.31GB（-24%）**。内訳は [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの)、経緯は [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)。

- [x] `build` ステージで `pnpm prune --prod` を実行し、devDependencies（typescript / eslint / vitest / prettier / prisma CLI 等）を本番イメージから除去する（-146MB）
- [x] glibc ベースなのに同梱されていた **musl 版ネイティブバイナリを削除**する（`@next/swc-linux-x64-musl` 125MB ほか。-約270MB）
- [x] `runner` の起動を `pnpm start` → `./node_modules/.bin/next start` へ直結し、不要になった `corepack install` を削除する
- [x] **`pino-pretty` が `devDependencies` にあるバグを修正する**（`LOG_PRETTY=true` で全リクエストが 500 になることを実機で確認 → `dependencies` へ移動）
- [x] **ローカルで `runner` イメージをビルドして起動し、動作確認する**（`/api/health?check=db` / CSS / 実ログイン / worker 起動まで。→ [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)）
- [x] **`worker` の `.env` 依存を解消する**（`--env-file` → `--env-file-if-exists`。PR #9）。本番イメージに `.env` が無く起動前に落ちていた問題と、クローン直後に `docker compose up worker` が失敗する問題を同時に解消（→ [worker の起動コマンド](TODO_補足.md#worker-の起動コマンド)）

</details>

<details>
<summary><b>3. Google Cloud Run</b> — 8 項目すべて完了（2026-08-04）</summary>

**本番稼働に到達した。** コンソールの UI が事前資料と大きく違ううえ Cloud Build が 2 回連続で失敗したため、画面単位の手順は [Cloud Run のサービス作成画面](TODO_補足.md#cloud-run-のサービス作成画面) と [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因) に集約した。経緯は [履歴](TODO_履歴.md#2026-08-04-cloud-run-の構築とログイン不能バグの修正)。

- [x] Google Cloud アカウントを作成し、課金を有効化する
- [x] Google Cloud プロジェクトを新規作成する（プロジェクト ID `multi-ai-agent-sample-2026`。**ID は作成後に変更不可**）
- [x] Cloud Run サービスを作成し、GitHub リポジトリを連携する（`contract-app` / **us-central1** / パブリック アクセスを許可 / 最小 0・**最大 2** / メモリ 512MiB / Developer Connect 経由）。**「サービスを作成」ボタンは存在せず、概要ページの「リポジトリの接続」から入る**
- [x] Cloud Run の環境変数を 9 個設定する（→ [本番の環境変数](TODO_補足.md#本番の環境変数)）
- [x] `AUTH_URL` を設定する（**作成画面にエンドポイント URL が表示されるため、当初想定した 2 段階デプロイは不要だった**）
- [x] `main` への push で Cloud Build が起動し自動デプロイされることを確認する（PR #11 のマージで検証。反映は JS チャンク名の変化で判定 → [デプロイ後の確認](TODO_補足.md#デプロイ後の確認)）
- [x] 本番 URL で `/api/health`（liveness）と `/api/health?check=db`（DB 疎通）を確認する
- [x] 本番 URL でログイン〜パスワード変更〜契約先/契約の登録までの一連の動作を確認する（**この過程でログイン不能のバグを発見し、PR #11 で修正した**）

**発見したバグ（PR #11）**: `mustChangePassword: true` のユーザーがログインすると、ログイン画面に戻り続けて先へ進めなかった。middleware（[`proxy.ts`](../../src/proxy.ts)）が Server Action の POST をリダイレクトしており、**リダイレクトによって POST が転送先へ再送される**ため `/` と `/settings/password` の間で往復し続けていた。判定を [`route-guard.ts`](../../src/modules/auth/route-guard.ts) の純粋関数へ切り出し、ログイン済みユーザーの誘導を GET のみに限定して解消した（回帰テスト 12 件追加。テスト 26 → 38）。あわせて 3 点を改善している（パスワード欄の表示切替、ロック閾値 5 → 20 回、初回変更画面でサイドバー非表示）。

</details>

## 現在の状態

- リポジトリ: `koekoebaborak27/multi-ai-agent-sample`（private）。**`main` = `a8181bd`**（初回コミット + PR #1〜#11 + ドキュメントのみの直接 push）。PR は 11 本ともマージ済み・ブランチ削除済み
- コミット署名は個人アカウント（`koekoebaborak27 <263120753+koekoebaborak27@users.noreply.github.com>`）。`--local` 設定のためグローバル（会社アカウント）は不変
- `gh` CLI 認証済み。scope は `gist` / `read:org` / `repo` / **`workflow`**
- CI（GitHub Actions）はグリーンで**警告 0 件**。ステップ順序のバグ（Typecheck が Prisma generate より前）とアクションの Node.js 20 非推奨は、どちらも修正済みで `main` に反映済み
- **CI は `**.md` / `docs/**` のみの変更では起動しない**（`paths-ignore`。2026-08-02 に設定し、実機で**検証済み**）。それ以外で CI を止めたい場合はコミットメッセージの `[skip ci]`（`f365896` で検証済み）。ただし **`paths-ignore` が効くのは GitHub Actions だけで、Cloud Build には効かない**ため、ドキュメントのみの変更でも本番デプロイは走る → [積み残しと検討事項](#積み残しと検討事項)
- **`main` にブランチ保護はかかっていない**（private リポジトリでは GitHub Pro か public 化が必要なため）。PR 運用は仕組みではなく運用ルールで守っている → [積み残しと検討事項](#積み残しと検討事項)
- **Supabase は使える状態**（2026-08-02 完了）。プロジェクト作成済み（East US (North Virginia)、Data API オフ）／Session pooler の接続文字列取得済み／**マイグレーション適用済み**（`20260723125616_init`）／**初期 ADMIN 投入済み**（`admin`・要パスワード変更）／**バケット `uploads` を private で作成済み**（`SUPABASE_URL` / `secret` キー取得済み・実装からの読み書きを実機確認済み）
- ローカルの `.env` には**本番 Supabase の `SUPABASE_URL` / `secret` キーを設定済み**。`STORAGE_TYPE` は `local`、`DATABASE_URL` は `localhost` のまま（→ [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか)）
- **本番は Google Cloud Run で稼働中**（2026-08-04 構築）。プロジェクト `multi-ai-agent-sample-2026` / サービス `contract-app` / リージョン **us-central1** / 最小インスタンス 0・**最大 2** / メモリ 512MiB（**実測 77MB**）/ パブリック アクセスを許可。URL は `https://contract-app-<プロジェクト番号>.us-central1.run.app` 形式で、コンソールの「サービスの詳細」に表示される
- **`main` への push で Cloud Build が起動し、自動デプロイされる**（2026-08-04 に PR #11 のマージで検証済み）。GitHub との接続は **Developer Connect** 経由。ビルド構成はトリガー内の**インライン YAML** で、`docker build --target runner -f docker/Dockerfile .`（**ビルドコンテキストはリポジトリルート**）+ `timeout: 1800s` → [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因)
- **Cloud Run の実行サービス アカウントは既定のまま**（`<プロジェクト番号>-compute@developer.gserviceaccount.com`）。プロジェクトの編集者権限を持っている → [積み残しと検討事項](#積み残しと検討事項)
- **本番の初期 ADMIN は `admin`**。2026-08-02 の seed 実行では `SEED_ADMIN_PASSWORD` が効いておらず、実際のパスワードは [`seed.ts`](../../prisma/seed.ts) の既定値 `Admin@123` だった（2026-08-04 に判明）。**本番稼働の確認時に変更済み**。なお [`seed.ts`](../../prisma/seed.ts) の `upsert` は `update: {}` のため、**再 seed では既存ユーザーのパスワードを上書きできない**（復旧するには DB を直接更新する）
- **2026-08-02 に残作業の順序を確定し**（署名 URL 化 → standalone 化 → Cloud Run）、**同日 2 番目を「Docker イメージの軽量化」へ差し替えたうえで、2026-08-04 に 3 つとも完了した** → [作業の順序](#作業の順序)
- **`getPublicUrl` は `getSignedUrl` へ差し替え済み**（2026-08-02・PR #7）。`StorageClient.getSignedUrl(path, expiresInSeconds?): Promise<string>`（既定 60 秒）。本番バケットに対して「ヘッダなしで開ける」「期限切れで 400 になる」ところまで実機確認済み。**存在しないオブジェクトへの発行は 400 → `AppError("STORAGE_SIGNED_URL_FAILED", 502)` になる**（→ [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)）
- **本番イメージは 1.31GB**（2026-08-02 に 1.73GB から軽量化。PR #8）。[`docker/Dockerfile`](../../docker/Dockerfile) の `runner` は devDependencies と musl バイナリを落とした `node_modules` を持ち込み、`CMD` は `./node_modules/.bin/next start`。**イメージに pnpm 実体は無い**（`corepack install` を削除したため）→ [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの)
- [`next.config.ts`](../../next.config.ts) は `output: "standalone"` **未設定**（意図的。→ [積み残しと検討事項](#積み残しと検討事項)）
- **`pino-pretty` は `dependencies`**（2026-08-02・PR #8）。[`logger.ts`](../../src/shared/observability/logger.ts) が `LOG_PRETTY=true` のとき実行時に解決するため、`devDependencies` に置くと本番で全リクエストが 500 になる
- **`worker` の起動は `--env-file-if-exists`**（2026-08-02・PR #9）。`.env` が無い環境（本番イメージ / クローン直後）でも起動する。ただし**本番コンテナ内では `pnpm worker` ではなく `./node_modules/.bin/tsx src/worker/index.ts` を使う**（イメージに pnpm が無いため）→ [worker の起動コマンド](TODO_補足.md#worker-の起動コマンド)
- **middleware は Server Action の POST をリダイレクトしない**（2026-08-04・PR #11）。判定は [`route-guard.ts`](../../src/modules/auth/route-guard.ts) の純粋関数 `decideRedirect` にあり、[`proxy.ts`](../../src/proxy.ts) はリクエストの読み取りとレスポンスの組み立てに徹する。**ログイン済みユーザーの誘導（`/login` → `/`、初回 PW 変更）は GET 限定**で、未ログイン時のガードと `/admin/*` の認可はメソッドを問わず適用される
- **ログイン失敗ロックの閾値は 20 回**（2026-08-04・PR #11。旧 5 回）。閾値に達すると `lockedAt` が立ち、**自動解除されない**（DB を直接更新するしかない）
- **パスワード入力欄は [`password-input.tsx`](../../src/shared/ui/password-input.tsx) に共通化済み**（2026-08-04・PR #11）。ログイン画面とパスワード変更画面の双方で、目のアイコンによる表示 / 非表示の切り替えが使える
- **初回パスワード変更が未了の間はサイドバー / ヘッダーを表示しない**（2026-08-04・PR #11）。[`(main)/layout.tsx`](<../../src/app/(main)/layout.tsx>) が `mustChangePassword` を見て、ログイン画面と同じ中央寄せの単独画面に切り替える
- ローカル環境の検証項目はすべて完了済み
- **VSCode でステップイン実行できる**（2026-08-03・PR #10）。[`.vscode/launch.json`](../../.vscode/launch.json) は Git 管理下（`.gitignore` を `.vscode/*` 除外 + `launch.json` / `extensions.json` のみ許可へ変更）。**Docker 接続時の接続先は app = `9230` / worker = `9231`**（`9229` は `pnpm` 自身のプロセスで、繋いでも止まらない）。[`docker-compose.yml`](../../docker/docker-compose.yml) の変更は `dev` ステージを使う 2 サービスに閉じており、**本番イメージ（`runner`）への影響はない**
- `update-todo` スキルを 3 エージェント分追加済み（正本 [`docs/skills/update-todo.md`](../skills/update-todo.md)）。**Claude Code / Codex での起動・検出は確認済み**、Copilot は未確認
- 初回コミット以降の変更（Supabase 手順の追記・スキル追加・CI 修正）は**すべて `main` に反映済み**

## 関連ドキュメント

| ファイル | 内容 |
|---|---|
| [`TODO_補足.md`](TODO_補足.md) | Supabase / Cloud Run の設定値・手順・落とし穴 |
| [`TODO_履歴.md`](TODO_履歴.md) | セッションごとの作業記録（旧「引き継ぎメモ」） |
| [`foundation_plan.md`](../foundation_plan.md) | 設計・確定方針の正本 |
| [`skills/update-todo.md`](../skills/update-todo.md) | このファイルの更新手順（スキルの正本） |

## ホスティング先の選定経緯

**2026-07-28: ホスティング先を Railway から Google Cloud Run へ変更した。** 当初は Railway を前提に手順を書いていたが、本番手順の妥当性を実装・各サービスの現況と突き合わせて検証した結果、**Railway の無料枠が実質廃止されている**ことが判明したため（$5 のトライアルクレジットは 30 日で失効、以後の Free plan は $1/月クレジットのみ。常時起動のコンテナを継続運用するには Hobby $5/月 が必要）。

Cloud Run は Always Free（200 万リクエスト + 180,000 vCPU 秒 + 360,000 GiB 秒/月）の範囲内なら $0 で、商用利用も可能。検討した候補と除外理由は次のとおり。

| 候補 | 判断 |
|---|---|
| **Google Cloud Run** | **採用**。Always Free が実用的な水準で、商用利用可。`docker/Dockerfile` をそのまま使える |
| Render | 次点。無料・クレカ不要だが 15 分でスピンダウンし復帰に約 1 分。512MB / 0.1 CPU |
| Railway | 無料枠が実質廃止（$5 トライアル 30 日 → 以後 $1/月）。継続には Hobby $5/月 |
| Vercel Hobby | **非商用限定**。報酬を得ている従業員が書いたコードも商用扱いとされ、業務案件へ流用する本テンプレートでは規約違反になる |
| Fly.io | 2026 年時点で無料枠なし（2 VM 時間 / 7 日のトライアルのみ） |
| Koyeb | Mistral AI による買収後、新規ユーザーへの無料枠を停止 |
| Cloudflare Workers | `@node-rs/argon2`（ネイティブバインディング）と pg-boss が動作しない |
