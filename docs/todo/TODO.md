# TODO

汎用契約管理システムテンプレートへの作り替え（[`foundation_plan.md`](../foundation_plan.md)）の残作業一覧。

> **残るは 3 つ。「署名 URL 化 → standalone 化 → Cloud Run 構築」の順で進める**（根拠は [作業の順序](#作業の順序)）。ローカル環境 / Git / GitHub / Supabase は完了済み。

## 目次

| 節 | 内容 |
|---|---|
| [進捗サマリ](#進捗サマリ) | 区分ごとの残数 |
| [作業の順序](#作業の順序) | 3 つの残作業をこの順に並べた理由 |
| [次にやること](#次にやること) | 次のセッションが最初に打つ手 |
| [残作業1 署名 URL 化](#残作業1-署名-url-化) | private バケットで壊れている `getPublicUrl` の差し替え |
| [残作業2 standalone 化](#残作業2-standalone-化) | Docker イメージの軽量化（コールドスタート対策） |
| [残作業3 Google Cloud Run](#残作業3-google-cloud-run) | 本番サーバの構築（ブラウザ作業） |
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
| ローカル環境 | 9 / 9 | 完了 |
| Git と GitHub | 13 / 13 | 完了 |
| Supabase（本番 DB / Storage） | 6 / 6 | 完了。実機で読み書きまで確認済み |
| **1. 署名 URL 化** | **0 / 5** | **未着手。次はここから** |
| 2. standalone 化 | 0 / 5 | 未着手。1 の次 |
| 3. Google Cloud Run | 0 / 8 | 未着手。1・2 を終えてから |
| 積み残しと検討事項 | 4 / 7 | 未対応 3 件（期限なし） |

## 作業の順序

2026-08-02 に**「署名 URL 化 → standalone 化 → Cloud Run 構築」の順**で確定した。当初は「残るインフラ作業は Cloud Run だけ」として Cloud Run を最優先に置いていたが、次の 2 点から順序を見直した。

| # | 作業 | 種別 | この順にした理由 |
|---|---|---|---|
| 1 | [署名 URL 化](#残作業1-署名-url-化) | コード | **いま安く、あとで高くなる**。`StorageClient` インターフェースの変更を伴うが、現時点で `getPublicUrl` の呼び出し元がゼロのため修正は 3 ファイルで済む。ファイル配信画面を作った後にやると呼び出し元すべてを追う羽目になる |
| 2 | [standalone 化](#残作業2-standalone-化) | コード + Docker | **いつやってもコストは変わらない**（`next.config.ts` と `docker/Dockerfile` で閉じている）。ただし Cloud Run より前に済ませておけば、本番へは最終形を 1 回デプロイするだけで済む |
| 3 | [Cloud Run 構築](#残作業3-google-cloud-run) | ブラウザ | **人の手が要る作業をまとめて最後に置く**。コード側を先に固めておけば、一度立てた本番に後から手を入れずに済み、課金対象のプロジェクトを準備段階から放置することもない |

**「standalone 化は Cloud Run の後でもよい」という判断も成り立つ**（GitHub 連携の自動デプロイなので、後から `main` に push すれば再デプロイされるだけ）。それでも前に置いたのは、**本番へ触る回数を 1 回に抑えるため**。ただしこの順序には条件があり、**standalone 化の PR ではローカルで `runner` イメージをビルドして起動確認まで行う**（→ [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点)）。これを飛ばすと未検証の構成をいきなり本番へ出すことになり、順序を入れ替えたメリットが消える。

## 次にやること

**[残作業1 署名 URL 化](#残作業1-署名-url-化) から着手する。** コードとテストだけで完結し、Cloud Run の完成を待つ必要がない。

最初に読むのは [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)。実装は [`types.ts`](../../src/shared/storage/types.ts) のインターフェース変更から入り、[`supabase.ts`](../../src/shared/storage/supabase.ts) → [`local.ts`](../../src/shared/storage/local.ts) の順に追随させる。

最初に打つコマンド（feature ブランチの作成）:

```powershell
git checkout -b fix/storage-signed-url
```

**コード**を変更するので、`main` へ直接 push せず **feature ブランチ → PR → CI green → squash マージ**の流れに従う（コマンドは [`TODO_履歴.md`](TODO_履歴.md#2026-08-02-pr-運用の開始と-ci-の順序バグ修正) の「PR 運用の型が固まった」を参照）。一方、**`.md` / `docs/` 配下だけの変更**は `paths-ignore` により CI が動かないため、`main` へ直接コミットして push してよい（手順は [`README.md`](../../README.md) の「ドキュメントだけの変更でCIを実行しない」）。Supabase / Cloud Run の設定作業そのものはリポジトリ外の操作なので、どちらの対象でもない。

各セッションの終わりには、エージェントに「TODO を更新して」（または `/update-todo`）と伝えてこのファイルを更新する。手順は [`docs/skills/update-todo.md`](../skills/update-todo.md)。

## 残作業1 署名 URL 化

private バケットでは [`getPublicUrl`](../../src/shared/storage/supabase.ts#L74-L77) が返す公開 URL が HTTP 400 で拒否されることを 2026-08-02 に実機確認した。**現時点でどのモジュールからも呼ばれていないため実害はないが、ファイル配信を実装する段階で必ず踏む**。バケットを public にする案は、契約書類を扱う以上採らない。方針の詳細は [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)。

- [ ] [`types.ts`](../../src/shared/storage/types.ts) の `StorageClient` を変更する（`getPublicUrl`（同期）では署名 URL を返せないため、非同期メソッドへ置き換える）
- [ ] [`supabase.ts`](../../src/shared/storage/supabase.ts) を `/object/sign/` へ問い合わせる実装にする（`apikey` ヘッダの併送は既存実装を踏襲する）
- [ ] [`local.ts`](../../src/shared/storage/local.ts) を新しいインターフェースへ追随させる（ローカルに署名の概念はないため、従来のパスを返すだけでよい）
- [ ] テストを追加し、**本番バケットに対して発行した署名 URL が実際に開けること**を実機確認する（手順は [ストレージ実装を tsx から直接呼ぶ](TODO_補足.md#supabase-の-api-キー形式) と同じ）
- [ ] feature ブランチ → PR → CI green → squash マージ。[`README.md`](../../README.md) の「ファイルストレージ」節にある `getPublicUrl` の但し書き（HTTP 400 で拒否される旨）も同じ PR で更新する

## 残作業2 standalone 化

現行イメージは `node_modules` を丸ごと持ち込むためサイズが大きく、**最小インスタンス 0 の Cloud Run ではコールドスタート時間に直結する**。Railway 前提だった頃より優先度は上がっている。**着手前に必ず [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) を読む**（worker と正面衝突する）。

- [ ] **worker を本番イメージでどう扱うか決める**（イメージから外す / ステージを分ける）。`output: "standalone"` は Next.js サーバに必要な依存しかトレースしないため、[`src/worker/`](../../src/worker/) と pg-boss / tsx は含まれない
- [ ] [`next.config.ts`](../../next.config.ts) に `output: "standalone"` を設定する（既存コメントの「`next start` と併用不可」も併せて解消する）
- [ ] [`docker/Dockerfile`](../../docker/Dockerfile) の `runner` ステージを standalone 出力ベースへ差し替える（`build` / `dev` ステージは壊さない）
- [ ] **ローカルで `runner` イメージをビルドして起動し、動作確認する**（この順序を選んだ前提条件。飛ばさないこと）
- [ ] feature ブランチ → PR → CI green → squash マージ

## 残作業3 Google Cloud Run

ここが終われば本番稼働に必要な作業はすべて片付く。**クレジットカード登録が必須**だが、Always Free の範囲内なら請求は発生しない。コンソール操作が中心で、リポジトリ側の変更は原則不要。

進めるうえでの要点は 3 つ。

1. **ビルド設定で `docker/Dockerfile` のパス指定を忘れない。** リポジトリ直下に `Dockerfile` が無いため、既定の自動検出では失敗する
2. **`AUTH_URL` は 2 段階。** デプロイ前は URL が分からないので、初回デプロイ → 発行された URL を環境変数に設定 → 再デプロイ、の順になる
3. **環境変数は Cloud Run のサービス設定に入れる。** 手元では `$env:` でそのセッションにのみ設定し、**本番の接続文字列を `.env` に書き込まない**（→ [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか)）

デプロイ後の確認は `/api/health` → `/api/health?check=db` → ログイン の順。**初回ログインでは初期 ADMIN のパスワードを必ず変更する**（`SEED_ADMIN_PASSWORD` に設定した値は使い捨て）。`STORAGE_TYPE=supabase` での読み書きは 2026-08-02 に実機確認済みなので、ストレージ周りで詰まる要素は残っていない。

- [ ] Google Cloud アカウントを作成し、課金を有効化する（**クレジットカード登録が必須**。Always Free の範囲内なら請求は発生しないが、登録自体は必要）
- [ ] Google Cloud プロジェクトを新規作成する
- [ ] Cloud Run サービスを作成し、「リポジトリから継続的にデプロイする」で GitHub リポジトリを連携する
  - ビルドタイプ: **Dockerfile**、パスに `docker/Dockerfile` を指定する（リポジトリ直下にないため既定では検出されない）
  - リージョン: **us-central1**（Always Free 対象）
  - 認証: 「未認証の呼び出しを許可」（アプリ側で Auth.js が認証するため）
  - 最小インスタンス数: **0**（コールドスタートを受け入れて無料枠に収める）
- [ ] Cloud Run の環境変数を設定する（[本番の環境変数](TODO_補足.md#本番の環境変数) を参照）
- [ ] 初回デプロイ後に発行された URL（`https://<service>-<hash>-uc.a.run.app`）を `AUTH_URL` に設定して**再デプロイする**（URL はデプロイ前には分からないため 2 段階になる）
- [ ] `main` ブランチへの push で Cloud Build が起動し、自動デプロイされることを確認する
- [ ] 本番 URL で `/api/health`（liveness）と `/api/health?check=db`（DB 疎通）を確認する
- [ ] 本番 URL でログイン〜パスワード変更〜契約先/契約の登録までの一連の動作を確認する

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
| 未実施 | [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針) | Supabase の署名 URL API と、インターフェース変更の影響範囲 |
| 未実施 | [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) | worker との衝突、ローカルでの検証コマンド |
| 未実施 | [本番の環境変数](TODO_補足.md#本番の環境変数) | Cloud Run のサービス設定に入れる値の一覧 |
| 未実施 | [本番で動かさないもの](TODO_補足.md#本番で動かさないもの) | pg-boss ワーカー / ローカル用 `db` サービス |

## 積み残しと検討事項

### 未対応

> **2026-08-02 に 2 件がここから昇格した。** 「`getPublicUrl` の署名 URL 化」は [残作業1](#残作業1-署名-url-化)、「`output: "standalone"` 化」は [残作業2](#残作業2-standalone-化) へ移動し、期限なしの宿題から**Cloud Run より前にやる作業**に格上げした（理由は [作業の順序](#作業の順序)）。

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
<summary><b>ローカル環境</b> — 9 項目すべて完了</summary>

- [x] Docker Desktop を起動し、`docker compose -f docker/docker-compose.yml up -d db` で PostgreSQL を起動する
- [x] `pnpm prisma:migrate -- --name init` で初期マイグレーションを生成・適用する（`prisma/migrations/` は現状空。生成された `migration.sql` は目視レビューする）
- [x] `pnpm prisma:seed` で初期 ADMIN ユーザーを投入する
- [x] `pnpm dev` を起動し、`/login` で Credentials ログイン（初期 ID: `admin` / 初期PW: `Admin@123`、または `SEED_ADMIN_PASSWORD` で指定した値）→ ダッシュボード表示を確認する
- [x] `/admin/users` の表示・RBAC 制御（ADMIN 以外はリダイレクトされること）を確認する
- [x] `/parties` で契約先の新規登録・一覧表示・削除を確認する
- [x] `/contracts` で契約先を選択して契約の新規登録・一覧表示・削除を確認する（契約先が0件の場合は先に `/parties` で登録する）
- [x] 別ターミナルで `pnpm worker` を起動し、pg-boss ワーカーが待受状態になることを確認する
- [x] ローカル開発を Docker だけで完結できるようにする（`docker/Dockerfile` に `deps` から分岐する `dev` ステージを追加し `pnpm dev`/`tsx watch` で起動、`docker-compose.yml` はソースコードをバインドマウントして即時反映させる。既存の `build`/`runner` ステージは変更せず、`main` push時の本番ビルドには影響させない）

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

## 現在の状態

- リポジトリ: `koekoebaborak27/multi-ai-agent-sample`（private）。**`main` = `0518b6d`**（全 13 コミット = 初回コミット + PR #1〜#6 + ドキュメントのみの直接 push 6 件）。PR は 6 本ともマージ済み・ブランチ削除済み
- コミット署名は個人アカウント（`koekoebaborak27 <263120753+koekoebaborak27@users.noreply.github.com>`）。`--local` 設定のためグローバル（会社アカウント）は不変
- `gh` CLI 認証済み。scope は `gist` / `read:org` / `repo` / **`workflow`**
- CI（GitHub Actions）はグリーンで**警告 0 件**。ステップ順序のバグ（Typecheck が Prisma generate より前）とアクションの Node.js 20 非推奨は、どちらも修正済みで `main` に反映済み
- **CI は `**.md` / `docs/**` のみの変更では起動しない**（`paths-ignore`。2026-08-02 に設定し、実機で**検証済み**）。それ以外で CI を止めたい場合はコミットメッセージの `[skip ci]`（`f365896` で検証済み）
- **`main` にブランチ保護はかかっていない**（private リポジトリでは GitHub Pro か public 化が必要なため）。PR 運用は仕組みではなく運用ルールで守っている → [積み残しと検討事項](#積み残しと検討事項)
- **Supabase は使える状態**（2026-08-02 完了）。プロジェクト作成済み（East US (North Virginia)、Data API オフ）／Session pooler の接続文字列取得済み／**マイグレーション適用済み**（`20260723125616_init`）／**初期 ADMIN 投入済み**（`admin`・要パスワード変更）／**バケット `uploads` を private で作成済み**（`SUPABASE_URL` / `secret` キー取得済み・実装からの読み書きを実機確認済み）
- ローカルの `.env` には**本番 Supabase の `SUPABASE_URL` / `secret` キーを設定済み**。`STORAGE_TYPE` は `local`、`DATABASE_URL` は `localhost` のまま（→ [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか)）
- **Google Cloud のアカウントは未作成**。残るインフラ作業は Cloud Run のみ
- **2026-08-02 に残作業の順序を確定した**（署名 URL 化 → standalone 化 → Cloud Run）。**この日のセッションではコードを一切変更していない**（作業ツリーはクリーン）。決めたのは順序と、standalone 化に付ける検証条件のみ → [作業の順序](#作業の順序)
- `getPublicUrl` は private バケットに対して機能しない状態のまま（[残作業1](#残作業1-署名-url-化)）。呼び出し元がゼロのため実害は出ていない
- [`next.config.ts`](../../next.config.ts) は `output: "standalone"` **未設定**。[`docker/Dockerfile`](../../docker/Dockerfile) の `runner` は `node_modules` を丸ごと持ち込む構成（[残作業2](#残作業2-standalone-化)）
- ローカル環境の検証項目はすべて完了済み
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
