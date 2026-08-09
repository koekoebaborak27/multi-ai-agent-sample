# TODO

汎用契約管理システムテンプレートへの作り替え（[`foundation_plan.md`](../foundation_plan.md)）の残作業一覧。

**2026-08-04 に本番稼働へ到達した。期限のある残作業はゼロ。** Cloud Run 上で動作しており、ログイン → パスワード変更 → 契約先 / 契約の登録まで実機で確認済み。`main` への push を契機に自動デプロイされることも確認した。以降は [残っているタスク](#残っているタスク)（期限のない宿題 6 件）から選んで進める。

TODO は 3 ファイルに分かれている。**同じ内容を 2 か所に書かないこと。**

| ファイル                       | 役割                                                   |
| -------------------------- | ---------------------------------------------------- |
| **このファイル**                 | 残タスク・進捗・現在の状態。「いま何が残っているか」だけを置く                      |
| [`TODO_補足.md`](TODO_補足.md) | 設定値・手順・落とし穴（コピペできるコマンド付き）。**作業の時系列順**で、上から読めば構築をなぞれる |
| [`TODO_履歴.md`](TODO_履歴.md) | セッションごとの作業記録と判断の経緯。**古いセッションほど上**。新しい記録は末尾に足す        |

## 進捗サマリ

| 区分                        | 進捗                   |
| ------------------------- | -------------------- |
| ローカル環境                    | 10 / 10              |
| Git と GitHub              | 13 / 13              |
| Supabase（本番 DB / Storage） | 6 / 6                |
| 1. 署名 URL 化               | 5 / 5                |
| 2. Docker イメージの軽量化        | 6 / 6                |
| 3. Google Cloud Run       | 8 / 8                |
| マスタ画面作りこみ（設計）             | 2 / 6                |
| マスタ画面作りこみ（製造）             | 0 / 6                |
| 残っているタスク                  | 4 / 10（未対応 6 件・期限なし） |

番号（`1`〜`3`）は 2026-08-02 に順序を確定したときのまま据え置いている。`2` は当初「standalone 化」だったが同日「Docker イメージの軽量化」へ差し替え、standalone 化は宿題へ降格した（経緯 → [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)）。

## 次にやること

テンプレートの土台は本番稼働まで到達した。
次はマスタ画面を作りこんでいく。具体的には以下を実施。

- マスタ画面の設計作りこみ
  
  - [x] **マスタおよびマスタ分類の削除**（2026-08-08 完了）。[`basic_design_master.md`](../specs/02_basic-design/basic_design_master.md) へ反映済み。**物理削除**・削除ボタンは詳細画面のみ・マスタ分類画面（MST-06 / MST-07）の新設まで含む → [履歴](TODO_履歴.md#2026-08-08-マスタ削除機能の設計)
  
  - [x] **マスタコードおよびマスタ分類の変更**（2026-08-08 完了）。[`basic_design_master.md`](../specs/02_basic-design/basic_design_master.md) へ反映済み。**画面が 7 → 11 枚**（MST-08〜MST-11 を追加）。マスタ分類を独立した登録・更新・削除へ切り出し、**MST-02 の「新しい分類を登録する」を廃止**した → [履歴](TODO_履歴.md#2026-08-08-マスタコードとマスタ分類の変更機能の設計)
  
  - [ ] CSVによる一括DL。（src/wokerを利用。一括登録・一括更新は不要。）
  
  - [ ] マスタの表示順を任意に変更する機能
  
  - [ ] マスタの有効期間、有効・無効状態の管理
  
  - [ ] 変更履歴の参照画面

- 上記をデザインに落とし込む

- 一画面ずつ製造。

- 他画面も設計から実施（workerを利用したCSVダウンロードの機能も実装）。

- テンプレをコピーして、新システムを別途作成。

**設計は 6 項目のうち 2 件が終わった段階で、製造は 1 件も着手していない。** マスタ機能は設計書だけが存在し、[`(main)/master/page.tsx`](<../../src/app/(main)/master/page.tsx>) はプレースホルダのまま、`Master` / `MasterCategory` テーブルも [`schema.prisma`](../../prisma/schema.prisma) に存在しない（→ [マスタ機能](#マスタ機能)）。

次のセッションは、次のどちらかを選ぶ。

1. **設計を続ける**。残り 4 項目のうち「CSVなどによる一括登録・一括更新」から着手する。worker（pg-boss）を使う初めての機能になるため、他の 3 項目より前提の確認が多い
2. **製造に入る**（推奨）。設計 2 件で画面が 11 枚まで増えたため、これ以上設計を積む前に一度動くものを作ったほうが、設計の粗も早く見つかる。**Prisma スキーマの追加から始める**

```powershell
docker compose -f docker/docker-compose.yml up -d db     # 製造に入る場合のみ
pnpm dlx shadcn@latest add alert-dialog                  # 削除ダイアログに必要（未導入）
```

製造は画面単位ではなく、次の順で進めると依存が素直になる。

```text
Prisma スキーマ + マイグレーション
  → マスタ分類の一覧・登録（MST-06 / MST-09 / MST-10）   ← マスタ登録の前提になる
  → マスタの検索一覧・登録・詳細（MST-01 / MST-02 / MST-03 / MST-04）
  → マスタの更新・コード変更（MST-05 / MST-08）
  → 削除一式（MST-07 / MST-11 / 各削除ダイアログ）
```

余裕があれば後述の、 [残っているタスク](#残っているタスク) も実施できると良い。

| 優先  | 項目                         | 理由                                                      |
| --- | -------------------------- | ------------------------------------------------------- |
| 1   | Cloud Run の実行サービス アカウントを絞る | 本番が動いている今も、コンテナがプロジェクトの編集者権限を持ったまま。リビジョン編集で差し替えるだけなので安い |
| 2   | `main` のブランチ保護             | 自動デプロイが動き出したため、`main` への誤 push が**そのまま本番へ出る**ようになった     |
| 3   | `output: "standalone"` 化   | 単独では価値が低い。worker 用イメージを分離するときに併せて行う                     |

手元の状態を確認するコマンドは次のとおり。

```powershell
git log --oneline -1                                     # main = 46e0f1e
git status --porcelain                                   # 何も出なければクリーン
docker compose -f docker/docker-compose.yml up -d db     # ローカル開発を再開する場合
```

本番が生きているかは、ブラウザを開かずに確認できる（URL は Cloud Run コンソールの「サービスの詳細」に表示される）。

```powershell
$base="https://contract-app-<プロジェクト番号>.us-central1.run.app"
Invoke-WebRequest "$base/api/health?check=db" -UseBasicParsing   # {"data":{"status":"ok","db":"up"}}
```

### push するときの注意

**2026-08-04 以降、`main` への push は本番デプロイを引き起こす。** `main` が更新されると Cloud Build が起動して Cloud Run へ反映される。`.md` だけの変更は GitHub Actions の CI こそ動かないが、**Cloud Build は別の仕組みなので走る**。

- **コード**を変更する場合: `main` へ直接 push せず feature ブランチ → PR → CI green → squash マージ（コマンドは [履歴](TODO_履歴.md#2026-08-02-pr-運用の開始と-ci-の順序バグ修正) の「PR 運用の型が固まった」）
- **`.md` / `docs/` 配下だけ**の変更: `paths-ignore` により CI が動かないため `main` へ直接 push してよい（手順は [`README.md`](../../README.md) の「ドキュメントだけの変更でCIを実行しない」）

各セッションの終わりには、エージェントに「TODO を更新して」（または `/update-todo`）と伝えてこのファイルを更新する。手順は [`docs/skills/update-todo.md`](../skills/update-todo.md)。

## 残っているタスク

いずれも**期限のない宿題**。優先度は [次にやること](#次にやること) を参照。

- [ ] **Cloud Run の実行サービス アカウントを、権限を持たない専用 SA に差し替える**（2026-08-04 追加）。現在は既定の `<プロジェクト番号>-compute@developer.gserviceaccount.com` を使っており、プロジェクトの編集者権限を持ったまま本番が動いている
  
  - このアプリは Google Cloud の API を一切呼ばない（DB もストレージも Supabase を直接叩く）ため、**権限ゼロの SA で動くはず**。[`docker/Dockerfile`](../../docker/Dockerfile) で非 root 実行までしている方針とも整合しない
  - サービス アカウントは**リビジョン編集で差し替え可能**（リージョンやサービス名と違い、やり直しが効く）。「新しいリビジョンの編集とデプロイ」→「セキュリティ」タブ
  - 差し替え後は `/api/health?check=db` とログインまで通し、本当に権限が不要であることを確認する

- [ ] **`main` のブランチ保護をどうするか決める**（当面は「運用ルールとして守る」で保留）。private リポジトリのブランチ保護は **GitHub Pro（$4/月）か public 化が必要**で、2026-08-02 時点では未設定
  
  ```powershell
  gh api repos/koekoebaborak27/multi-ai-agent-sample/branches/main/protection
  # → Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
  ```
  
  - つまり現状は **CI が赤でも `Merge pull request` を押せてしまう**し、`main` への直接 push も止まらない。[`AGENTS.md`](../../AGENTS.md) の「`main` 保護 + feature ブランチ → PR」は仕組みで強制されておらず、運用ルールとして守っている状態
  - 選択肢: ①このまま運用ルールで守る（無料・当面はこれ） ②テンプレートを public 化する（無料だが公開前提の内容精査が必要） ③GitHub Pro（$4/月）
  - 有効化する場合の設定箇所は Settings → Branches → Add branch protection rule で、**Require status checks to pass before merging** に `verify` を指定する

- [ ] **ドキュメントのみの変更で Cloud Build を走らせない仕組みを入れるか決める**（2026-08-04 追加）。GitHub Actions 側の `paths-ignore` は **Cloud Build には効かない**ため、`.md` の修正のたびに 5〜10 分のビルドと Cloud Run のリビジョン作成が発生する
  
  - 選択肢: ①放置（Always Free の範囲なら実害なし。現状はこれ） ②コミットメッセージに `[skip ci]` を付ける（Cloud Build も同じ文字列に対応） ③トリガーの「含まれるファイルと無視されるファイルのフィルタ」で `**.md` / `docs/**` を除外する
  - ③が仕組みとして確実だが、**トリガー設定は Git 管理外**なので、リポジトリを clone しただけでは再現しない（テンプレートとして配る際は手順書が要る）

- [ ] **`output: "standalone"` 化を検討する**（2026-08-02 に残作業からここへ差し戻し）。**着手の適時は「worker 用イメージを `runner` から分離するとき」**。イメージを分ければ app 側は worker を気にせず standalone にでき、[案 B](TODO_補足.md#standalone-化の設計上の論点) が成立する
  
  - 単独でやる価値は低い。コールドスタートの**起動処理そのものは縮まない**うえ、軽量化 PR で 1.73GB → 1.31GB を worker と衝突せずに達成済み（理由 → [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)）
  - 着手する場合の論点・落とし穴 5 つ・ローカル検証コマンドは [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) に整理済み
  - 併せて [`next.config.ts`](../../next.config.ts) の既存コメント（「`next start` と併用不可のため設定しない」）も解消する

- [ ] **マイグレーションの自動化を検討する**（当面はローカルからの手動 `prisma migrate deploy`）。Cloud Run には Railway の Pre-Deploy Command に相当する仕組みがないため、自動化するなら Cloud Run Jobs か Cloud Build のデプロイ後ステップになる

- [ ] `/update-todo` が GitHub Copilot Chat（`chat.promptFiles` が有効なこと）で実際に起動するか確認する。**Claude Code は 2026-08-02 のセッションで起動と正本（`docs/skills/update-todo.md`）の読み込みを確認済み**。Codex は `codex debug prompt-input` で検出済み

## 現在の状態

事実のみ。予定と経緯は書かない。

### リポジトリと CI

| 項目                 | 状態                                                                                                                                                  |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| リポジトリ              | `koekoebaborak27/multi-ai-agent-sample`（private）。**`main` = `46e0f1e`**。PR #1〜#11 はすべてマージ済み・ブランチ削除済み。以降のドキュメント変更は `main` へ直接 push している              |
| コミット署名             | 個人アカウント（`koekoebaborak27 <263120753+koekoebaborak27@users.noreply.github.com>`）。`--local` 設定のためグローバル（会社アカウント）は不変                                    |
| `gh` CLI           | 認証済み。scope は `gist` / `read:org` / `repo` / `workflow`                                                                                              |
| CI（GitHub Actions） | グリーンで**警告 0 件**。ステップ順序のバグとアクションの Node.js 20 非推奨はどちらも修正済み                                                                                            |
| CI のスキップ           | `**.md` / `docs/**` のみの変更では起動しない（`paths-ignore`。実機で検証済み）。他の場合はコミットメッセージの `[skip ci]`。**`paths-ignore` が効くのは GitHub Actions だけで Cloud Build には効かない** |
| ブランチ保護             | **かかっていない**（private リポジトリでは GitHub Pro か public 化が必要）。PR 運用は運用ルールで守っている                                                                             |

### 本番（Google Cloud Run）

| 項目           | 状態                                                                                                                                                                                                        |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 稼働状況         | **稼働中**（2026-08-04 構築）。プロジェクト `multi-ai-agent-sample-2026` / サービス `contract-app` / リージョン **us-central1** / 最小 0・最大 2 / メモリ 512MiB（**実測 77MB**）/ パブリック アクセスを許可                                             |
| URL          | `https://contract-app-<プロジェクト番号>.us-central1.run.app` 形式。コンソールの「サービスの詳細」に表示される                                                                                                                            |
| 構築手順         | **正本は [`READ_ME_INFRA.md`](../specs/99_infra/READ_ME_INFRA.md)**（GitHub / Supabase / Cloud Run をゼロから構築する手順書）。[`TODO_補足.md`](TODO_補足.md) は当時の実測値と経緯の記録として残している                                             |
| 自動デプロイ       | **`main` への push で Cloud Build が起動する**（PR #11 のマージで検証済み）。GitHub との接続は **Developer Connect** 経由                                                                                                            |
| ビルド構成        | トリガー内の**インライン YAML**。`docker build --target runner -f docker/Dockerfile .`（**ビルドコンテキストはリポジトリルート**）+ `timeout: 1800s` → [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因)                    |
| 実行サービス アカウント | **既定のまま**（`<プロジェクト番号>-compute@developer.gserviceaccount.com`）。プロジェクトの編集者権限を持っている → [残っているタスク](#残っているタスク)                                                                                                  |
| 本番イメージ       | **1.31GB**（1.73GB から軽量化。PR #8）。`runner` は devDependencies と musl バイナリを落とした `node_modules` を持ち、`CMD` は `./node_modules/.bin/next start`。**イメージに pnpm 実体は無い** → [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの) |
| standalone   | [`next.config.ts`](../../next.config.ts) は `output: "standalone"` **未設定**（意図的）                                                                                                                            |

### 本番データ（Supabase）

| 項目           | 状態                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| プロジェクト       | 作成済み（**East US (North Virginia)**、Data API オフ）。Session pooler の接続文字列を取得済み                                                                                                    |
| DB           | **マイグレーション適用済み**（`20260723125616_init`）。**初期 ADMIN 投入済み**                                                                                                                    |
| Storage      | **バケット `uploads` を private で作成済み**（`SUPABASE_URL` / `secret` キー取得済み・実装からの読み書きを実機確認済み）                                                                                        |
| 初期 ADMIN     | ID は `admin`。2026-08-02 の seed では `SEED_ADMIN_PASSWORD` が効いておらず、実際は [`seed.ts`](../../prisma/seed.ts) の既定値だった（2026-08-04 に判明）。**本番稼働の確認時に変更済み**                              |
| 再 seed の注意   | [`seed.ts`](../../prisma/seed.ts) の `upsert` は `update: {}` のため、**再 seed では既存ユーザーのパスワードを上書きできない**（復旧するには DB を直接更新する）                                                         |
| ローカルの `.env` | **本番 Supabase の `SUPABASE_URL` / `secret` キーを設定済み**。`STORAGE_TYPE` は `local`、`DATABASE_URL` は `localhost` のまま → [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか) |

### アプリの仕様

| 項目         | 状態                                                                                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ストレージ      | **`getPublicUrl` は `getSignedUrl` へ差し替え済み**（PR #7）。`getSignedUrl(path, expiresInSeconds?): Promise<string>`（既定 60 秒）。**存在しないオブジェクトへの発行は 400 → `AppError("STORAGE_SIGNED_URL_FAILED", 502)`** → [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)         |
| ロギング       | **`pino-pretty` は `dependencies`**（PR #8）。[`logger.ts`](../../src/shared/observability/logger.ts) が `LOG_PRETTY=true` のとき実行時に解決するため、`devDependencies` に置くと本番で全リクエストが 500 になる                                                                         |
| worker の起動 | **`--env-file-if-exists`**（PR #9）。`.env` が無い環境でも起動する。ただし**本番コンテナ内では `pnpm worker` ではなく `./node_modules/.bin/tsx src/worker/index.ts`**（イメージに pnpm が無いため）→ [worker の起動コマンド](TODO_補足.md#worker-の起動コマンド)                                                |
| middleware | **Server Action の POST をリダイレクトしない**（PR #11）。判定は [`route-guard.ts`](../../src/modules/auth/route-guard.ts) の純粋関数 `decideRedirect` にあり、[`proxy.ts`](../../src/proxy.ts) は読み取りと組み立てに徹する。**ログイン済みユーザーの誘導は GET 限定**、未ログイン時のガードと `/admin/*` の認可はメソッドを問わず適用 |
| ログイン失敗ロック  | 閾値は **20 回**（PR #11。旧 5 回）。到達すると `lockedAt` が立ち、**自動解除されない**（DB を直接更新するしかない）                                                                                                                                                                         |
| パスワード入力欄   | [`password-input.tsx`](../../src/shared/ui/password-input.tsx) に共通化済み（PR #11）。ログイン画面とパスワード変更画面の双方で表示 / 非表示を切り替えられる                                                                                                                                   |
| 初回パスワード変更  | 未了の間はサイドバー / ヘッダーを表示しない（PR #11）。[`(main)/layout.tsx`](<../../src/app/(main)/layout.tsx>) が `mustChangePassword` を見て単独画面に切り替える                                                                                                                        |

### マスタ機能

**設計のみ存在し、実装は 1 行も無い。** 設計書に載っている画面は 11 枚（MST-01〜MST-11）。

| 項目            | 状態                                                                                                                             |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| 基本設計書         | [`basic_design_master.md`](../specs/02_basic-design/basic_design_master.md)（1078 行）。**MST-01〜MST-11 の 11 画面**が反映済み（2026-08-08） |
| 画面            | [`(main)/master/page.tsx`](<../../src/app/(main)/master/page.tsx>) は `FeaturePlaceholder` を返すだけ。`src/modules/master/` は存在しない   |
| DB            | `Master` / `MasterCategory` は [`schema.prisma`](../../prisma/schema.prisma) に**未追加**。設計書 §8.2 はモデル「案」であり、マイグレーションも無い           |
| 削除方式          | **物理削除**（論理削除は不採用）。理由は削除したマスタコード / 分類名を再利用できなくなるため → 設計書 §8.3                                                                  |
| 削除の権限・導線      | ADMIN / OPERATOR のみ。削除ボタンは**詳細画面（MST-04 / MST-07）だけ**に置き、一覧には置かない                                                              |
| 変更できる項目       | マスタ内容は MST-05、マスタコードと所属分類は **MST-08（専用画面）**、マスタ分類名は MST-11。`id` / `createdAt` / `createdBy` は変更しない → 設計書 §8.2                  |
| マスタ分類の登録      | **MST-09 でのみ行う**。マスタ新規登録画面（MST-02）とコード変更画面（MST-08）からは登録できず、登録済みの分類を選ぶだけ。分類が 0 件のときは MST-02 の「確認する」を無効化する                       |
| 利用中チェック       | **行わない**。参照されていても削除・変更できる。参照側は外部キーを張らず**マスタコードも保持しない**（ID のみ）。取得できなければ「未設定」と表示する → 設計書 §8.4                                    |
| 監査            | `createdBy` / `updatedBy` を持つ（FK なし）。削除と変更の記録はアプリログのみ（`withOp` の引数出力を使う）。**コードと分類名は変更前の値もログへ渡す**（マスタ内容の更新は渡さない）→ 設計書 §10.1     |
| Server Action | 7 つ（マスタの登録・更新・コード変更・削除、マスタ分類の登録・更新・削除）→ 設計書 §11                                                                                |
| 未導入の依存        | `AlertDialog`（`pnpm dlx shadcn@latest add alert-dialog`）。[`src/shared/ui/`](../../src/shared/ui/) には `dialog.tsx` しか無い         |

### 開発環境

| 項目          | 状態                                                                                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ローカル検証      | 検証項目はすべて完了済み                                                                                                                                                                |
| VSCode デバッグ | **ステップイン実行できる**（PR #10）。[`.vscode/launch.json`](../../.vscode/launch.json) は Git 管理下。**Docker 接続時の接続先は app = `9230` / worker = `9231`**（`9229` は `pnpm` 自身のプロセスで、繋いでも止まらない） |
| エージェント スキル  | `update-todo` を 3 エージェント分追加済み（正本 [`docs/skills/update-todo.md`](../skills/update-todo.md)）。**Claude Code / Codex での起動・検出は確認済み**、Copilot は未確認                                |

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

当初この枠は「standalone 化」だったが、**worker と衝突しない施策だけで同等の効果が出る**ことが分かったため差し替えた。**1.73GB → 1.31GB（-24%）**。内訳は [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの)、差し替えの判断と経緯は [履歴](TODO_履歴.md#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)。

- [x] `build` ステージで `pnpm prune --prod` を実行し、devDependencies（typescript / eslint / vitest / prettier / prisma CLI 等）を本番イメージから除去する（-146MB）
- [x] glibc ベースなのに同梱されていた **musl 版ネイティブバイナリを削除**する（`@next/swc-linux-x64-musl` 125MB ほか。-約270MB）
- [x] `runner` の起動を `pnpm start` → `./node_modules/.bin/next start` へ直結し、不要になった `corepack install` を削除する
- [x] **`pino-pretty` が `devDependencies` にあるバグを修正する**（`LOG_PRETTY=true` で全リクエストが 500 になることを実機で確認 → `dependencies` へ移動）
- [x] **ローカルで `runner` イメージをビルドして起動し、動作確認する**（`/api/health?check=db` / CSS / 実ログイン / worker 起動まで）
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

<details>
<summary><b>宿題から片づけたもの</b> — 4 項目</summary>

- [x] `package.json` の `pnpm.onlyBuiltDependencies`（Prisma 等のビルドスクリプト許可設定）が他の開発者環境・CI でも意図通り機能するか確認する（2026-08-01 の初回 CI で `pnpm install --frozen-lockfile` 以降が全ステップ成功したことで検証済み）。**ただし 2026-08-02 に判明したとおり、pnpm ストアがキャッシュヒットすると postinstall 自体が走らない**ため、postinstall による副作用（`prisma generate` 等）を前提にした構成にはしないこと

- [x] **`paths-ignore` が実際に CI をスキップすることを確認した**（2026-08-02）。TODO 更新コミット（`docs/todo/TODO.md` の 1 ファイルのみ・`[skip ci]` なし）を `main` へ push し、対応する run が作られないことを確認済み
  
  ```powershell
  gh run list --limit 3   # → 直前の push に対応する行が現れなければ成功
  ```

- [x] `src/shared/storage/supabase.ts`（`@supabase/supabase-js` 非依存の REST API 実装）を実際の Supabase バケットに対して疎通確認する（2026-08-02 実施。**`apikey` ヘッダ不足で全操作が失敗するバグを発見し PR #6 で修正**。修正後は upload → download（内容一致）→ remove → 削除の反映まで通ることを実機で確認済み）

- [x] **GitHub Actions のバージョンを更新する**（PR #2 で実施・マージ済み）。`actions/checkout` v4→**v7** / `actions/setup-node` v4→**v7** / `pnpm/action-setup` v4→**v6**。Node.js 20 ターゲットの非推奨警告が消えたことを確認済み（アノテーション 0 件）
  
  - この Node.js は**アクション自身を動かす裏方の実行環境**であり、`.nvmrc`（アプリ側の Node = 22）とは無関係
  - 破壊的変更はリリースノートで全て確認済み。本プロジェクトへの影響はなかった
  - **今後アクションを上げるときも同じ手順**: 各リポジトリの `.0.0` リリースノートを読む → 上げる → PR の CI で検証

</details>

## 関連ドキュメント

| ファイル                                                                                              | 内容                                                                            |
| ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [`specs/99_infra/READ_ME_INFRA.md`](../specs/99_infra/READ_ME_INFRA.md)                           | **インフラ構築手順書の正本**。本番環境をゼロから構築する手順（アカウント作成〜動作確認）                                |
| [`specs/02_basic-design/basic_design_master.md`](../specs/02_basic-design/basic_design_master.md) | マスタ管理機能の基本設計書（MST-01〜MST-11）                                                  |
| [`TODO_補足.md`](TODO_補足.md)                                                                        | **このプロジェクトを構築したときの実測値と経緯の記録**。手順の正本は `READ_ME_INFRA.md` へ移した。**冒頭に節ごとの目次がある** |
| [`TODO_履歴.md`](TODO_履歴.md)                                                                        | セッションごとの作業記録と判断の経緯（ホスティング先の選定を含む）                                             |
| [`foundation_plan.md`](../foundation_plan.md)                                                     | 設計・確定方針の正本                                                                    |
| [`skills/update-todo.md`](../skills/update-todo.md)                                               | このファイルの更新手順（スキルの正本）                                                           |
