# TODO 作業履歴

[`TODO.md`](TODO.md) から分離した、セッションごとの作業記録（旧「引き継ぎメモ」）。
**古いセッションほど上**（時系列順）に並べている。上から読めば、このプロジェクトが辿った経緯を最初から追える。残タスクの一覧は本編、手順や設定値の詳細は [`TODO_補足.md`](TODO_補足.md) を見ること。

ここに書くのは「何をやったか」「なぜそうしたか」「どこで詰まったか」の 3 つ。同じ落とし穴を次のセッションが踏まないようにするための記録なので、**うまくいかなかった過程も残す**。

**新しいセッションは末尾に追加する**（目次も同様）。

## 目次

| セッション | 主な内容 |
|---|---|
| [2026-07-28 ホスティング先の選定](#2026-07-28-ホスティング先の選定) | Railway の無料枠が実質廃止 → Cloud Run へ変更。候補 7 つの比較 |
| [2026-07-28 Git の初期化とコミット前チェック](#2026-07-28-git-の初期化とコミット前チェック) | 署名の分離、機密資料の除外、ローカル CI 相当 |
| [2026-08-01 GitHub と CI](#2026-08-01-github-と-ci) | 初回 push、`workflow` スコープ不足、初回 CI |
| [2026-08-01 Supabase セットアップ](#2026-08-01-supabase-セットアップ) | プロジェクト作成、Session pooler の取得 |
| [2026-08-01 スキル基盤の整備](#2026-08-01-スキル基盤の整備) | `update-todo` を 3 エージェント共通で追加 |
| [2026-08-02 PR 運用の開始と CI の順序バグ修正](#2026-08-02-pr-運用の開始と-ci-の順序バグ修正) | PR #1 / #2、Prisma generate の順序バグ、Actions 更新 |
| [2026-08-02 開発フローの README 化と CI のスキップ設定](#2026-08-02-開発フローの-readme-化と-ci-のスキップ設定) | PR 運用の README 化、`paths-ignore` と `[skip ci]` の 2 段構え |
| [2026-08-02 本番 DB の構築と Storage の疎通確認](#2026-08-02-本番-db-の構築と-storage-の疎通確認) | migrate / seed の実行、`apikey` ヘッダ不足のバグ発見と PR #6 |
| [2026-08-02 残作業の順序を確定する](#2026-08-02-残作業の順序を確定する) | 署名 URL → standalone → Cloud Run に決定。コード変更なし |
| [2026-08-02 署名 URL 化](#2026-08-02-署名-url-化) | `getPublicUrl` → `getSignedUrl` へ差し替え。PR #7、本番バケットで実機確認 |
| [2026-08-02 Docker イメージの軽量化と worker の .env 依存解消](#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消) | standalone 化を差し替え。PR #8 / #9、1.73GB → 1.31GB、既存バグ 2 件を発見 |
| [2026-08-03 VSCode デバッグ環境の整備](#2026-08-03-vscode-デバッグ環境の整備) | PR #10。ステップイン実行に対応。inspector ポートの取り合いを実測で解決 |
| [2026-08-04 Cloud Run の構築とログイン不能バグの修正](#2026-08-04-cloud-run-の構築とログイン不能バグの修正) | **本番稼働に到達**。Cloud Build が 2 連続で失敗。middleware と Server Action の衝突を PR #11 で修正 |

## 2026-07-28 ホスティング先の選定

**ホスティング先を Railway から Google Cloud Run へ変更した。** 当初は Railway を前提に手順を書いていたが、本番手順の妥当性を実装・各サービスの現況と突き合わせて検証した結果、**Railway の無料枠が実質廃止されている**ことが判明したため（$5 のトライアルクレジットは 30 日で失効、以後の Free plan は $1/月クレジットのみ。常時起動のコンテナを継続運用するには Hobby $5/月 が必要）。

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

## 2026-07-28 Git の初期化とコミット前チェック

**1. Git リポジトリの初期化とコミット署名の設定**

```powershell
git init -b main
git config --local user.name  "koekoebaborak27"
git config --local user.email "263120753+koekoebaborak27@users.noreply.github.com"
```

`--local` はこのリポジトリの `.git/config` にのみ書き込まれ、グローバル設定（`--global`／会社アカウント `y.koeda@bee-partners.co.jp`）より優先される。**会社の他リポジトリには一切影響しない**。この設定を入れないとグローバル設定が使われ、個人リポジトリに会社名義のコミットが並ぶことになる。

メールアドレスは GitHub が発行する noreply アドレスを採用した。コミットは `koekoebaborak27` に紐づくが、実メールは履歴に残らないため、将来 public 化しても安全。

なお `gh auth`（GitHub への接続権限）と `git config user.email`（コミットに刻まれる署名）は独立した設定であり、両方を個人に揃える必要がある。

**2. `docs/legacy-contract-reference/` を Git 管理から除外**

コミット前のスキャンで、同ディレクトリに契約システム（参考版）の**実在するインフラ情報**が含まれていることが判明したため除外した。

| 内容 | 例 |
|---|---|
| AWS アカウント ID | `329599627418` |
| 許可 IP アドレス（社内固定 IP 8 件） | `158.95.56.219/32` ほか |
| ALB の実 DNS 名 | `it-royalty-stg-alb-....elb.amazonaws.com` |
| Secrets Manager / ACM の ARN | `arn:aws:secretsmanager:...:it-royalty-stg/AUTH_SECRET-yUcyRs` |

秘密鍵・パスワード・アクセスキーの実体は含まれていなかった（ARN はシークレットの置き場所であって値ではない）。除外した理由は次の 2 点。

- 会社案件のインフラ資料を個人 GitHub アカウントに保管する形になり、社内規定に触れる可能性がある
- テンプレートを将来 public 化した際、AWS アカウント ID + 許可 IP + ALB DNS が一括で露出する

実施内容は `.gitignore` への `docs/legacy-contract-reference/` 追加と `git rm -r --cached` によるステージからの除外、および `AGENTS.md` / `README.md` / `docs/foundation_plan.md` からの参照記述の削除。**ローカル作業ツリーにはファイルが残っている**ため参照は継続できる（clone では取得されない）。

**3. ローカルで CI 相当のチェックを実施**（全項目グリーン）

| 項目 | 結果 |
|---|---|
| `pnpm lint` | exit 0 |
| `pnpm format:check` | All matched files use Prettier code style |
| `pnpm typecheck` | exit 0 |
| `pnpm exec prisma validate` | The schema at prisma\schema.prisma is valid |
| `pnpm test` | 3 files / 9 tests passed |
| `pnpm build` | Compiled successfully（全 10 ルート生成） |

`prisma migrate deploy`（[ci.yml](../../.github/workflows/ci.yml) にはある）はローカルでは実施していない。「空の DB からスキーマを再現できるか」の検証が目的であり、適用済みのローカル DB では検証にならないため、GitHub Actions 側（毎回まっさらな PostgreSQL が立つ）に委ねる。

## 2026-08-01 GitHub と CI

**1. 初回コミットと GitHub への push**

```powershell
git add -A
git commit -m "chore: 汎用契約管理システムテンプレートの初回コミット"
gh repo create multi-ai-agent-sample --private --source=. --remote=origin --push
```

リポジトリ名は当初案の `contract-template` ではなく **`multi-ai-agent-sample`** を採用した（`koekoebaborak27/multi-ai-agent-sample`・private）。**Cloud Run の GitHub 連携時に選ぶのはこの名前**。

**2. `workflow` スコープ不足による push 失敗と対処**

`gh repo create --push` の push だけが次のエラーで失敗した。

```
! [remote rejected] HEAD -> main
  (refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope)
```

GitHub は `.github/workflows/` 配下を特別扱いしており、**`workflow` スコープを持つトークンでしか push できない**。`gh` の既存トークンは `repo` / `gist` / `read:org` のみだったため拒否された。リポジトリ作成と remote 追加自体は成功していたので、スコープを追加して push し直した。

```powershell
gh auth refresh -h github.com -s workflow
git -c credential.helper= -c credential.helper="!gh auth git-credential" push -u origin main
```

2 行目が必要な理由: この PC の `credential.helper` は **Git Credential Manager（`manager`）**であり、`gh` のトークンとは**別のトークン**を git に渡している。`gh auth refresh` でスコープを足しても `manager` 側のトークンは古いままなので、push で使う資格情報を `gh` のものへ差し替える必要があった。`-c credential.helper=`（空値）で既存ヘルパーの一覧をリセットし、続く `-c` で `gh` を登録している。**このコマンド実行中だけの上書きで、設定ファイルには書き込まれない**。

`git config --global` で恒久設定しなかったのは、この PC の他リポジトリ（会社案件）まで個人アカウント `koekoebaborak27` のトークンで認証されてしまうため。恒久化するなら `git config --local`（このリポジトリの `.git/config` のみ）を使うこと。次回以降の push で同じエラーが出たら、上記 2 行目の形式を使う。

**3. GitHub Actions の CI がグリーンであることを確認**

`main` への push を契機に [ci.yml](../../.github/workflows/ci.yml) が起動し、**1m36s で success**。これにより次の 2 点が初めて検証された。

| 検証項目 | 結果 |
|---|---|
| `prisma migrate deploy`（空の PostgreSQL 16 から `prisma/migrations/` だけでスキーマを再現できるか） | 成功 |
| `pnpm.onlyBuiltDependencies`（Prisma 等の postinstall が CI でも許可されるか） | 成功。`pnpm install --frozen-lockfile` 以降の全ステップが通った |

## 2026-08-01 Supabase セットアップ

**1. Supabase プロジェクトを作成**

GitHub アカウントでサインアップし、**East US (North Virginia)** でプロジェクトを作成した。作成画面での判断（Data API オフ、GitHub 連携なし、automatic RLS オフ）とその理由は [プロジェクト作成画面の設定](TODO_補足.md#supabase-プロジェクト作成画面の設定) に整理してある。**リージョンは作成後に変更できない**ため、作り直す場合はここを最優先で確認すること。

**2. Session pooler の接続文字列を取得**

Connect ダイアログの UI が紛らわしく、既定の Framework タブ（`supabase-js` 向け）や ORM タブ（Transaction pooler + `directUrl` 前提で本プロジェクトでは動かない）に誘導されやすい。歩き方と Session pooler の見分け方は [Connect ダイアログの歩き方](TODO_補足.md#connect-ダイアログの歩き方) に整理した。取得した文字列は `aws-0-us-east-1.pooler.supabase.com:5432` / ユーザー `postgres.<プロジェクトref>` の形式で、条件を満たしていることを確認済み。

**3. 本番 DB への適用手順を確定**（実行はこれから）

コマンドは [本番 DB への適用手順](TODO_補足.md#本番-db-への適用手順) に 1 行ずつコピーできる形で記載した。**PowerShell ではシングルクォート必須**（ダブルクォートだとパスワード中の `$` が変数展開される）という落とし穴があるため、手順側に明記している。

## 2026-08-01 スキル基盤の整備

**1. `update-todo` スキルを 3 エージェント共通で追加**

「TODO を更新し、影響があれば README も更新する」作業を手順化した。手順の**正本は [`docs/skills/update-todo.md`](../skills/update-todo.md) の 1 ファイル**で、各ツールの入口はそれを読ませるだけの薄いラッパーにしてある（`AGENTS.md` ↔ `CLAUDE.md` ↔ `copilot-instructions.md` と同じ「正本 + 薄い入口」方式）。

| ツール | 入口ファイル | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/update-todo/SKILL.md` | `/update-todo` または自動起動 |
| GitHub Copilot | `.github/prompts/update-todo.prompt.md` | Copilot Chat で `/update-todo` |
| Codex | `.agents/skills/update-todo/SKILL.md` | 自動起動 |

正本には **README を触る/触らないの判定表**を入れてある。これがないと「TODO のチェックを付けただけ」で README まで書き換えられてしまうため、判定基準を明文化する側に倒した。

**2. Codex のリポジトリ内スキル置き場が `.agents/skills/` であることを特定**

リポジトリ直下にあった**空の `.agents/` ディレクトリは Codex が作ったもの**だった。Codex CLI 0.121.0 のバイナリに `failed to stat repo skills root` と `.agents` の文字列があり、実機でも検出を確認済み。

```powershell
codex debug prompt-input "test"   # → Available skills に update-todo が出る
```

当初は「Codex のプロンプトは `~/.codex/prompts/`（ユーザー単位）でリポジトリに置けない」と判断しかけたが、これは誤りだった。**3 ツールともリポジトリ管理できる**ため、個人環境に置くファイルは 1 つもない。

**3. スキル方式を `AGENTS.md` / README に反映**

[`AGENTS.md`](../../AGENTS.md) に「スキル（作業手順）」節を追加し、トップレベル構成の表へ `.agents/` / `.claude/` / `docs/skills/` を追記した。スラッシュコマンドを使わず「TODO を更新して」と伝えるだけでも、`AGENTS.md` からの参照で同じ手順に到達する。README 側は [`README.md`](../../README.md) の「AIエージェントによる開発」「ドキュメント」表と [`README_SIMPLE.md`](../../README_SIMPLE.md) の「AIエージェントで開発する」を更新済み。

## 2026-08-02 PR 運用の開始と CI の順序バグ修正

**1. feature ブランチ → PR の運用を開始（PR #1）**

[`AGENTS.md`](../../AGENTS.md) の「`main` 保護 + feature ブランチ → PR」方針に従い、初回コミット以降の未コミット分を `main` へ直接 push せず、ブランチ `docs/agent-skills-update-todo` に載せて PR を作成した。

| コミット | 内容 |
|---|---|
| `0751372` | `docs:` `update-todo` スキルの追加（正本 + 3 ツール分の入口）と TODO / README 更新 |
| `3b83966` | `fix(ci):` Prisma generate を Typecheck より前に移動 |

PR #1 は TODO / README の更新（`aa08ce6`）も加えた 3 コミットで CI green を確認し、**squash マージ済み**（`main` = `849ee7a`、ブランチは削除）。

**2. CI の順序バグを発見して修正（重要）**

PR 作成後の CI が `Typecheck` で失敗した。

```
Module '"@prisma/client"' has no exported member 'Party' / 'Prisma' / 'User' / 'PrismaClient'  ほか計 10 件
```

原因は [`ci.yml`](../../.github/workflows/ci.yml) のステップ順序で、**Prisma Client（生成物）を作る前に `tsc --noEmit` を実行していた**こと。`Prisma generate` を `Typecheck` の前へ移動して解決した（1m18s で success）。

**なぜ 2026-08-01 の初回 CI では気づけなかったか**が本質的な落とし穴なので記録しておく。

| | pnpm ストアキャッシュ | `@prisma/client` の postinstall | Typecheck |
|---|---|---|---|
| 初回（main / run 30702732130） | 無し（コールド） | 実行され `✔ Generated Prisma Client` をログに出力 | **偶然**成功 |
| 本 PR（run 30704826147） | ヒット | **走らない**（`Install dependencies` が 3.8s で完了、生成ログなし） | 失敗 |

つまり初回 CI は「順序が正しかったから」ではなく「依存パッケージの postinstall が偶然 generate してくれたから」通っていた。[`ci.yml`](../../.github/workflows/ci.yml) には再発防止のコメントを残してある。**生成物は、それを参照するステップより前に自分のワークフローで明示的に作ること**。

なお 2026-08-01 の記録にある「`pnpm.onlyBuiltDependencies` が CI で機能することを検証済み」は誤りではないが、**キャッシュヒット時は postinstall 自体が走らない**ため、それに依存した構成にはしないこと。

**3. GitHub Actions を Node.js 24 対応版へ更新（PR #2・マージ済み）**

CI は通るものの「アクションが Node.js 20 ターゲットで非推奨」の警告が 1 件出ていたため、3 アクションをまとめて更新した（`main` = `a3173a0`）。

| アクション | 変更 |
|---|---|
| `actions/checkout` | v4 → v7 |
| `actions/setup-node` | v4 → v7 |
| `pnpm/action-setup` | v4 → v6 |

メジャー 3 世代跨ぎのため各リリースノートを確認したが、**本プロジェクトに影響する破壊的変更はなかった**（詳細は [`TODO.md`](TODO.md#完了済みの作業) の該当項目）。更新後の CI は 1m19s で success、**非推奨警告は 0 件**になった。

この Node.js は**アクション自身を動かす裏方の実行環境**で、`.nvmrc`（アプリ側 = 22）とは別物。混同しやすいので注意。

**4. PR 運用の型が固まった**

このセッションで 2 本の PR を通し、次の流れが確立した。以降のセッションもこの形で進める。

```powershell
git checkout -b <type>/<内容>     # 例: fix/xxx, chore/xxx, docs/xxx
# 変更 → コミット（何を・なぜ・どう検証したかを本文に書く）
git push -u origin <ブランチ名>
gh pr create --base main --title "..." --body-file <本文ファイル>
# CI green を確認してから
gh pr merge <番号> --squash --delete-branch
```

`gh pr merge --delete-branch` はマージ後にローカルを `main` へ切り替えて pull まで行うため、追加の同期操作は不要。

## 2026-08-02 開発フローの README 化と CI のスキップ設定

**1. 変更を Git に反映する開発フローを README に明文化（PR #5・`08d6409`）**

これまで PR 運用の手順はこの履歴の「PR 運用の型が固まった」にしかなく、リポジトリを初めて触る人が README だけで辿れなかった。[`README.md`](../../README.md) に「変更をGitに反映する（開発フロー）」節を追加し、次を記載した。

- 全体の流れ（ブランチ作成 → コミット → push → PR → CI → マージ → 後片付け）の図
- **コマンドで実行する場合**（`gh` を使う 7 ステップ）
- **GitHub のサイト上で手作業する場合**（CI の 🟡🟢🔴 の見方、`Delete branch` ボタン、その後にローカルで必要な後片付け 5 ステップ）
- `git branch -d` が squash マージ後に "not fully merged" で失敗する理由と `-D` の使いどころ
- PowerShell のヒアストリング（`@'` 〜 `'@`、**閉じる `'@` は行頭**）で日本語の複数行コミットメッセージを渡す方法

**2. ドキュメントのみの変更で CI を起動しないようにした（`f365896`）**

README / TODO / `docs/` 配下は lint・型チェック・ビルドの対象外であり、これらだけの変更で CI を回すのは待ち時間と Actions 使用時間の無駄になるため、**2 段構えの仕組み**を入れた。

| | 対象 | 判定 |
|---|---|---|
| **仕組み1: `paths-ignore`** | `**.md` / `docs/**` | GitHub が自動判定。**変更ファイルが 1 つ残らず一致した場合のみ**スキップ |
| **仕組み2: `[skip ci]`** | 上記に当てはまらない CI 不要ファイル（`.claude/settings.json` 等） | コミットメッセージに人が付ける |

[`ci.yml`](../../.github/workflows/ci.yml) の `pull_request` / `push` **両方**に `paths-ignore` を追加した（片方だけだともう片方の契機で動いてしまう）。

```yaml
on:
  pull_request:
    paths-ignore:
      - "**.md"
      - "docs/**"
  push:
    branches: [main]
    paths-ignore:
      - "**.md"
      - "docs/**"
```

設計上の要点を 3 つ記録しておく。

- **`paths-ignore` は安全側に倒れている。** 「すべて一致した場合のみスキップ」なので、コードが 1 ファイルでも混ざれば通常どおり全ステップが走る。`[skip ci]` は逆に人の判断なので、誤って付けると検証が丸ごと飛ぶ。**基本は `paths-ignore` に任せ、`[skip ci]` は例外扱い**にした
- **`ci.yml` 自身はどちらのパターンにも一致しない。** CI の設定変更は必ず CI で検証される
- **`paths-ignore` が効くのは GitHub Actions だけ。** 本番デプロイの Cloud Build は別の仕組みなので、ドキュメントのみの変更でもデプロイは走る。止めるなら Cloud Build 側のトリガー設定か `[skip ci]`（Cloud Build も同じ文字列に対応）。**Cloud Run 未構築のため未検証**

[`README.md`](../../README.md) 側にも「ドキュメントだけの変更でCIを実行しない（`main`へ直接push）」節を追加した。通常フローとの対比表、CI 不要 / CI 必須のファイル判定表、7 ステップの手順、共通の注意点を記載している。あわせて「CI（GitHub Actions）」節と「補足」にも `paths-ignore` の但し書きを入れた。

**3. `f365896` は `main` へ直接 push した（例外的な判断）**

`ci.yml` を含む変更なので、本来は PR → CI green → マージが筋。だが今回は CI を回さない判断とし、`[skip ci]` を付けて `main` へ直接 push した。事前に `pnpm exec prettier --check .github/workflows/ci.yml` を通し、**YAML のパースエラーで CI が永久に動かなくなる事態は潰してある**。push 後に確認した結果は次のとおり。

```powershell
gh run list --limit 5
# → 最新は 1 つ前の 08d6409（#5）のまま。f365896 に対応する run は作られていない
gh api repos/koekoebaborak27/multi-ai-agent-sample/actions/workflows --jq '.workflows[] | "\(.name) | \(.state)"'
# → CI | active（ワークフロー自体は有効のまま）
```

この時点では `[skip ci]` の効果しか確認できていなかった（このコミットは `[skip ci]` で止めたため、`paths-ignore` の判定を通っていない）。→ 次項で検証した

**4. `paths-ignore` の効果を検証した（同日）**

[`TODO.md`](TODO.md) を更新するコミット（同ファイル 1 つのみ）を、**`[skip ci]` を付けずに** `main` へ直接 push した。`gh run list --limit 3` に対応する run が現れないことを確認し、**`paths-ignore` が期待どおり動作している**ことを実機で確かめた。

これで 2 つの仕組みが両方とも検証済みになった。

| 仕組み | 検証したコミット | 結果 |
|---|---|---|
| `[skip ci]` | `f365896`（`ci.yml` + `README.md`） | run が作られない |
| `paths-ignore` | TODO 更新コミット（`.md` 1 ファイル） | run が作られない |

**以降、`.md` / `docs/` 配下だけの変更は feature ブランチ / PR を作らず `main` へ直接 push してよい。**

## 2026-08-02 本番 DB の構築と Storage の疎通確認

**Supabase セクションの残り 3 項目をすべて完了した。** これで本番 DB とストレージは使える状態になり、残るインフラ作業は Google Cloud Run だけになった。

**1. 本番 DB にマイグレーションを適用し、初期 ADMIN を投入した**

[本番 DB への適用手順](TODO_補足.md#本番-db-への適用手順) のとおりに実行し、詰まる箇所はなかった。

| 手順 | 結果 |
|---|---|
| `prisma migrate status` | `20260723125616_init` が未適用と表示（＝ Session pooler 経由の接続が通ることの確認） |
| `prisma migrate deploy` | `All migrations have been successfully applied.` |
| `pnpm prisma:seed` | `Seed 完了: 初期ADMIN(admin)` |

`SEED_ADMIN_PASSWORD` は指定済みだが、**Cloud Run デプロイ後の初回ログインで必ず変更すること**（[`prisma/seed.ts`](../../prisma/seed.ts) が `mustChangePassword: true` を立てるため画面側で強制される）。

なお `pnpm prisma:seed` は初期 PW を**平文で標準出力に表示する**（[`prisma/seed.ts:36`](../../prisma/seed.ts#L36)）。ログを他人に見せるときは注意。手順に **`Set-PSReadLineOption -HistorySaveStyle SaveNothing`**（手順 0）を追加したので、次回からコマンド履歴への平文保存も防げる。

**2. Storage バケット `uploads` を private で作成した**

ダッシュボードでの作成自体は迷わないが、**キーの取得で 2 か所引っかかる**ので手順側（[Supabase の API キー形式](TODO_補足.md#supabase-の-api-キー形式)）に整理した。

- Settings → **API Keys**（旧 UI では API）。`publishable` / `secret` という新形式で表示される場合があり、**使うのは `secret` 側**
- `SUPABASE_URL` は探さなくてよい。**接続文字列のユーザー名 `postgres.<ref>` から `https://<ref>.supabase.co` と分かる**

**3. 疎通確認で実装のバグを発見し、PR #6 で修正した（重要）**

積み残しだった「[`src/shared/storage/supabase.ts`](../../src/shared/storage/supabase.ts) を実バケットに対して疎通確認する」を実施したところ、**upload / download / remove のすべてが HTTP 400 で失敗した**。

```
{"statusCode":"403","error":"Unauthorized","message":"Invalid Compact JWS","code":"AccessDenied"}
```

原因は、**新形式の API キー（`sb_secret_...`）が JWT ではない**のに `Authorization: Bearer <key>` だけを送っていたこと。Supabase 側が JWT としてパースしようとして失敗していた。`apikey` ヘッダを併送すれば解決する（旧 `service_role` の JWT でも併送で動作するため、両形式に対応できる）。

切り分けは**素の `fetch` でヘッダの組み合わせを 4 通り試して応答本文を読む**方法が速かった。実装は `res.status` しかエラーに載せない（[`supabase.ts`](../../src/shared/storage/supabase.ts) の `AppError`）ため、**400 の本文を見ないと原因に辿り着けない**。同種の切り分けをする場合は本文を出すこと。

修正後は 5 項目すべて成功した。

```
OK   upload
OK   download — 内容が一致
OK   private バケット — 公開URLは HTTP 400 で拒否
OK   remove
OK   削除の反映 — 取得できないことを確認
```

3 番目は「失敗するのが正解」の逆転項目で、バケットが private であることの確認になっている。**この結果から `getPublicUrl` が本番で使えないことが確定した**ので、署名 URL への差し替えを「積み残し」に追加した。

**4. 回帰テストを追加した**

[`src/shared/storage/supabase.test.ts`](../../src/shared/storage/supabase.test.ts)（10 件）。3 メソッドが両ヘッダを送ること・URL 組み立て・失敗時の `AppError` code を検証している。**実装から `apikey` を外すと 3 件落ちることを確認**してから採用した（テストが回帰を捕まえられることの確認）。

`server-only` と `env` は `vi.mock` で無効化している。前者は既定の解決だと import 時に throw するため、テストでは避けて通れない。

PR #6 は CI green（1m25s）で squash マージ済み。**`main` = `28a5e89`**。

**5. ローカル `.env` の運用方針を決めた**

毎回 `$env:` で 3 つ設定するのが煩雑なため、**`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` は `.env` に本番の値を置く**ことにした（`STORAGE_TYPE=local` が安全弁として効くため）。`DATABASE_URL` は従来どおり置かない。判断根拠と切り替え方は [ローカルの .env に本番の値を置いてよいか](TODO_補足.md#ローカルの-env-に本番の値を置いてよいか) に整理した。

`.env` には `# STORAGE_TYPE=supabase` のコメント行も用意してあるが、**切り替えは `$env:STORAGE_TYPE='supabase'` の一時上書きを推奨**する（戻し忘れると以降のローカル開発が本番バケットを書き換えるため）。

## 2026-08-02 残作業の順序を確定する

**このセッションではコードを一切変更していない**（作業ツリーはクリーンのまま）。決めたのは**残作業をどの順にやるか**だけだが、当初の想定と結論が変わったので経緯を残す。更新したのは [`TODO.md`](TODO.md) / [`TODO_補足.md`](TODO_補足.md) / このファイルの 3 つ。

**1. 当初の想定と、それが崩れた理由**

セッション開始時点の [`TODO.md`](TODO.md) は「**残るインフラ作業は Cloud Run だけ**」と書いており、署名 URL 化と standalone 化は「積み残しと検討事項」（期限なしの宿題）に置かれていた。この前提でエージェント側は当初、**standalone 化 → Cloud Run** の順を推した。理由は「Dockerfile を変える以上、後からやると引っ越しをやり直すことになる」というもの。

**この理由は誤りだった。** Cloud Run は GitHub 連携の自動デプロイ（push 契機の Cloud Build トリガー）なので、**後から Dockerfile を変えても `main` に push すれば再デプロイされるだけ**で、やり直しではない。

**2. 決定した順序と根拠**

ユーザーからの「署名 URL 化を先に片づけたほうがよいのでは」「2 → 1 → 3 のほうがよくないか」という 2 度の指摘を受けて見直し、**署名 URL 化 → standalone 化 → Cloud Run 構築**で確定した。判断基準は「**いま安く、あとで高くなる作業を先にやる**」。

| # | 作業 | コストの時間変化 |
|---|---|---|
| 1 | 署名 URL 化 | **時間とともに上がる**。`StorageClient` インターフェースの変更を伴い、`getPublicUrl` の呼び出し元が増えるほど修正範囲が広がる。現時点の呼び出し元は**ゼロ**（`src/app/` `src/modules/` からの参照なしを `grep` で確認） |
| 2 | standalone 化 | **変わらない**。`next.config.ts` と `docker/Dockerfile` で閉じている |
| 3 | Cloud Run | 変わらない。ただし人の手（ブラウザ操作）が要る |

standalone 化を Cloud Run の**前**に置いたのは、**本番へ触る回数を 1 回に抑えるため**（一度立てた本番に後から Dockerfile 変更を入れるより、最終形を 1 回デプロイするほうが安全）。加えて、ブラウザ作業をまとめて最後に置けること、課金対象のプロジェクトを準備段階から放置せずに済むことも理由。

**3. 「切り分けのために基準点を作る」案を捨てた理由**

エージェント側は一度、**Cloud Run → standalone 化**（先に素直な構成でデプロイを成功させ、動く基準点を作ってから standalone 化する）を推した。デプロイが失敗したとき「Cloud Run の設定ミスか standalone のせいか」を切り分けられる、という理屈である。

これは「**standalone 化は Cloud Run 上でしか検証できない**」という誤った前提に立っていた。実際には [`docker/Dockerfile`](../../docker/Dockerfile) の `runner` ステージを**手元でビルドして起動すれば検証できる**。手元で動くところまで確認しておけば、Cloud Run で問題が出ても原因は Cloud Run 固有のもの（環境変数・ポート・権限）に絞れるため、基準点は不要だった。

**ただしこれは条件付きの結論**なので、`TODO.md` の `残作業2` のチェックリストに「**ローカルで `runner` イメージをビルドして起動確認する**」を必須項目として明記した。ここを飛ばすと未検証の構成をいきなり本番へ出すことになり、順序を入れ替えたメリットが消える。検証コマンドは [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) に置いた。

> **後日の補足**（2026-08-02）: `残作業2` はその後「Docker イメージの軽量化」へ差し替えられ、この見出しは [完了済みの作業](TODO.md#完了済みの作業) へ移動した。上記の「ローカルで起動確認する」という必須項目自体は差し替え後も引き継がれ、実際に本番イメージを起動して確認している（→ [2026-08-02 Docker イメージの軽量化と worker の .env 依存解消](#2026-08-02-docker-イメージの軽量化と-worker-の-env-依存解消)）。

**4. standalone 化が worker と衝突することが分かった（着手前の発見）**

`output: "standalone"` は Next.js サーバに必要な依存しかトレースしないため、**[`src/worker/`](../../src/worker/) と pg-boss / tsx は出力に含まれない**。ところが現行の `runner` ステージは「1 つのイメージでアプリと worker の両方を動かす」設計なので、そのままでは両立しない。

対応案は「worker を本番イメージから外す」か「ステージを分ける」の 2 つで、[本番で動かさないもの](TODO_補足.md#本番で動かさないもの) に「本番で pg-boss ワーカーは起動しない」と既に決めてある以上、**前者が素直**。ただし採用は着手時に再確認する。この論点と、他 5 つの落とし穴（起動コマンド・`public/` と `.next/static`・`HOSTNAME`・Prisma engine・`serverExternalPackages`）は [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) に整理した。

**5. 補足へ 2 節を追加した**

いずれも**実機未確認**（着手していないため）であることを節の冒頭に明記してある。実装時に判明した事実で上書きすること。

| 節 | 内容 |
|---|---|
| [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針) | Supabase の `/object/sign/` API の仕様、応答が `/storage/v1` を含まない相対パスである点、影響範囲 4 ファイル、有効期限を短くする理由、`Invoke-RestMethod` での確認コマンド |
| [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) | worker との衝突と 2 案、5 つの落とし穴、`docker build --target runner` によるローカル検証手順 |

**6. TODO の構成を変えた**

「積み残しと検討事項」にあった 2 件を、期限なしの宿題から**残作業のチェックリスト**へ昇格させた。これに伴い本編の残作業セクションを 3 つ（`残作業1` / `残作業2` / `残作業3`）に分割し、進捗サマリと「次にやること」も書き換えている。「残作業 Google Cloud Run」という見出しは **`残作業3 Google Cloud Run` に改名**したので、古いアンカーを参照している箇所があれば直すこと。

**7. この履歴ファイルを時系列順（古い順）に並べ替えた**

従来は「新しいセッションほど上」だったが、**上から読めば経緯を最初から追える**ほうが引き継ぎに向くため、**2026-07-28 を先頭とする時系列順**へ反転した。目次も同じ順に並べ替えている。内容の変更はなく、順序だけを入れ替えた。

これに伴い、**新しいセッションの追記先が「先頭」から「末尾」へ変わった**。[`docs/skills/update-todo.md`](../skills/update-todo.md)（スキルの正本）と [`TODO.md`](TODO.md) の説明文も同じ内容へ修正済み。

## 2026-08-02 署名 URL 化

残作業1（署名 URL 化。完了したため [`TODO.md`](TODO.md#完了済みの作業) の「完了済みの作業」へ移動済み）を実施した。**PR #7 をマージ済み**（`main` = `3e8487f`）。前セッションで決めた順序（署名 URL → standalone → Cloud Run）の 1 番目にあたる。

**1. 何を変えたか**

`StorageClient` の URL 発行メソッドを差し替えた。

| before | after |
|---|---|
| `getPublicUrl(path): string`（同期） | `getSignedUrl(path, expiresInSeconds?): Promise<string>`（非同期） |

同期メソッドのままでは API 呼び出しの結果を返せないため、インターフェースの変更を伴う。既定の有効期限は **60 秒**（`DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS` として [`types.ts`](../../src/shared/storage/types.ts) に定義）。API の仕様と確定した実装は [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針) に集約した。

**変更は 5 ファイルで閉じた**（`src/shared/storage/` の 4 つ + `README.md`）。事前に見積もった「影響範囲 4 ファイル」どおりで、`src/app/` `src/modules/` には一切波及していない。**呼び出し元がゼロのうちに変える**という順序判断はそのまま機能した。

**2. 実機確認で分かったこと**

本番バケットに対し、使い捨てスクリプトを `uploads/`（`.gitignore` 済み）へ置いて tsx で直接実行した（コマンドは [署名 URL への差し替え方針](TODO_補足.md#署名-url-への差し替え方針)）。**認証ヘッダを付けずに `fetch` する**ことで、ブラウザで開くのと同じ条件を再現している。

| # | 確認内容 | 実測 |
|---|---|---|
| 1 | `upload` | 成功 |
| 2 | 署名 URL をヘッダなしで取得 | 200・内容一致 |
| 3 | `expiresIn: 1` で発行 → 3 秒後に取得 | 400 `InvalidJWT`（`"exp" claim timestamp check failed`） |
| 4 | 公開 URL（署名なし） | 400 `NoSuchBucket` |

3 番目まで確認したのは、**200 が返るだけでは期限切れが効いているか分からない**ため。有効期限を短くする設計に意味があることを実測で押さえた。

**新たに判明した落とし穴**: **存在しないオブジェクトへの署名 URL 発行は HTTP 400 で失敗する**（検証オブジェクトを削除した後に発行を試みて発見）。実装は `AppError("STORAGE_SIGNED_URL_FAILED", 502)` を投げるため、画面側で「ファイルが無い」と「Supabase 側の障害」を区別したい場合は追加の作り込みが要る。既存の `download` も同様に 404 相当を 502 にしているので、**今回は一貫性を優先してそのままにした**。ファイル配信画面を作る段階で再検討すること。

**3. 検証用オブジェクトは削除した**

本番バケットに `signed-url-check/hello.txt` を置いて確認したので、終了後に `remove` し、`download` が失敗することで削除を確認した。使い捨てスクリプト 3 本も削除済み（`uploads/` は `.gitignore` 済みだが、[`tsconfig.json`](../../tsconfig.json) の `include` が `**/*.ts` のため `pnpm typecheck` の対象になる。残すと次のセッションで邪魔になる）。

**4. 実行したコマンド**

```powershell
git checkout -b fix/storage-signed-url
# 実装・テスト修正
pnpm lint; pnpm typecheck; pnpm format:check; pnpm test   # すべて成功（テスト 26 件）
git add -A; git commit; git push -u origin fix/storage-signed-url
gh pr create --base main --head fix/storage-signed-url
gh run watch <run-id> --exit-status                        # CI green
gh pr merge 7 --squash --delete-branch
git checkout main; git pull --ff-only; git remote prune origin
```

`pnpm format:check` は **1 回落ちた**（`supabase.ts` の import 文の折り返し）。`pnpm exec prettier --write <file>` で修正した。Prettier は `*.md` を対象外にしているが **`.ts` は対象**なので、コミット前に必ず通すこと。

**5. README を更新した**

「ファイルストレージ」節にあった `getPublicUrl` の但し書き（HTTP 400 で拒否される旨の警告）を、`getSignedUrl` の使い方・保存先ごとの挙動・有効期限を短く保つ理由へ書き換えた。**警告を消すのではなく、使い方の説明へ置き換えている**（private バケットで公開 URL が使えないという事実自体は残しておく必要があるため）。`README_SIMPLE.md` はストレージに触れていないため変更なし。

## 2026-08-02 Docker イメージの軽量化と worker の .env 依存解消

**`残作業2` を「standalone 化」から「Docker イメージの軽量化」へ差し替えて実施した。** PR #8 / #9 をマージ済み（**`main` = `d6e18f3`**）。**1.73GB → 1.31GB（-24%）**。作業の過程で**既存バグを 2 件発見して修正**した。

**1. なぜ standalone 化をやめたか（ユーザーからの問いが起点）**

ユーザーから「worker の影響が大きいように見えるが、この残作業は本当に必要か。コールドスタートが十数秒程度なら一旦いいのでは」という問いがあり、前提を検証したところ **`残作業2` の根拠が弱いことが判明した**。

| 論点 | 検証結果 |
|---|---|
| コールドスタートへの効果 | `output: "standalone"` が縮めるのは**イメージ取得時間だけ**。起動する Next サーバのコードは同じなので、**Node 起動 → Next 初期化 → Prisma 初期化という起動処理そのものは縮まない**。「十数秒なら許容」という前提なら、やっても十数秒のまま |
| 順序のリスク | standalone を先にやると、Cloud Run 初回デプロイで「Cloud Run の設定ミス」と「standalone の 5 つの落とし穴」が**同時に初見**になる。逆順なら動くベースラインを先に確保でき、Cloud Run のリビジョン切り戻しは 1 クリック |
| 代替の有無 | **worker と一切衝突しない施策**（devDependencies 除去・musl バイナリ除去・起動コマンド直結）だけで同等の削減が取れる |

**当初エージェント側が「`.next/cache` に数百 MB の無駄がある」と見積もったのは誤りだった。** ローカルの `.next` が 403MB あったのを根拠にしたが、これは**開発サーバのキャッシュを含む値**。Docker ビルド内で生成される `.next/cache` は **340KB** しかなかった。**見積もりは実測で潰すこと。**

代わりに、想定していなかった無駄が見つかった。ベースイメージは `node:22-bookworm-slim`（**glibc**）なのに、pnpm が optionalDependencies として **musl 版のネイティブバイナリ**（`@next/swc-linux-x64-musl` 125MB ほか）も配置していた。**絶対に読み込まれないファイルで、削減の大半はこちら**（-約270MB）。

`pnpm prune --prod` も期待ほど効かなかった（-146MB）。**トップレベルのシンボリックリンクは消えるが `.pnpm` ストアの実体は peer 依存の参照で残る**（`typescript` 23MB / `prisma` 67MB は `@prisma/client` から peer 参照されている）。実測値は [本番イメージから落としたもの](TODO_補足.md#本番イメージから落としたもの) に集約した。

**2. 発見したバグ その1: `pino-pretty` が `devDependencies` にあった（PR #8）**

prune を入れた本番イメージを起動したところ、**全リクエストが 500** になった。

```
⨯ Error: unable to determine transport target for "pino-pretty"
```

[`logger.ts`](../../src/shared/observability/logger.ts) は `LOG_PRETTY=true` のとき `pino-pretty` を transport target として**実行時に**解決するため、実体はランタイム依存。従来は本番イメージが devDependencies を丸ごと抱えていたため露見していなかった。本番は `LOG_PRETTY=false` の想定なので普段は踏まないが、**デバッグのため有効化した瞬間にアプリ全体が落ちる地雷**だったため `dependencies` へ移した。

**軽量化は「使っていないものを消す」作業なので、隠れたランタイム依存を炙り出す。** 同種の作業をするときは、消した後に必ず実際の起動・ログイン・DB アクセスまで通すこと。

**3. 発見したバグ その2: `pnpm worker` が本番で起動できない（PR #9）**

ユーザーから「`pnpm worker` は本番では使えない、の意味が分からない」という問いを受けて実機で確認したところ、**2 つの独立した理由**があった。

| 理由 | 実測 | 対処 |
|---|---|---|
| `.env` が本番イメージに無い | `node: .env: not found` / exit 9 で**起動前に落ちる** | `--env-file` → `--env-file-if-exists` へ変更（PR #9） |
| イメージに pnpm 実体が無い | `Corepack is about to download https://registry.npmjs.org/pnpm/...` | 本番コンテナ内では `./node_modules/.bin/tsx src/worker/index.ts` を使う（仕様として Dockerfile にコメント） |

**副次的に、クローン直後の `docker compose up worker` も直った。** [`README.md`](../../README.md) は「`.env` はファイル自体が `worker` の起動に必要なため必ず作成してください」と書いて回避していたが、compose は接続情報を `environment:` で注入しており**本来 `.env` は不要**だった。compose 側も `--env-file-if-exists` にして制約自体を外した。

`worker` / `worker:prod` の 2 本に分ける案（ユーザー承認済み）から**方針を変えた**。`--env-file-if-exists` なら 1 本で両対応でき、使い分けを覚える必要がなくなるため。着手前に使えるか実測してから採用している（Node v22.23.2 / v24.15.0 の双方で利用可）。

**4. 実機確認（本番 runner イメージ）**

[standalone 化の落とし穴](TODO_補足.md#standalone-化の設計上の論点) として挙げていた項目を、軽量化版で先に潰した。

| # | 確認内容 | 実測 |
|---|---|---|
| 1 | `/api/health` | `{"status":"ok"}` |
| 2 | `/api/health?check=db` | `{"status":"ok","db":"up"}`（Prisma のクエリエンジンが prune 後も残っている） |
| 3 | `/login` と参照する CSS | ともに 200 |
| 4 | Credentials ログイン | 成功（`authjs.session-token` 発行）／誤パスワードは拒否（`@node-rs/argon2` が動作） |
| 5 | 認証後の `/` `/parties` `/contracts` | いずれも 200 |
| 6 | 同イメージからの worker 起動 | pg-boss 待受まで到達 |

4 番目は Auth.js のログインが Server Action（[`actions.ts`](../../src/modules/auth/actions.ts) の `loginWithCredentials`）のため HTTP で直接叩けない。**`/api/auth/csrf` で CSRF トークンを取り、`/api/auth/callback/credentials` へ POST する**方法で確認した。検証用ユーザーは `uploads/`（`.gitignore` 済み）の使い捨てスクリプトで作成し、終了後に削除している。

**開発フローの非回帰も確認した。** `docker compose up --build app worker` で `dev` ステージが従来どおり起動する（app は `/api/health` と `/login` が 200、worker は pg-boss 待受）。`dev` ステージは `deps`（devDependencies 込み）から分岐しており、変更は `build` / `runner` に閉じている。

**5. worker の将来像が確定した**

ユーザーから「worker は CSV アップロード / ダウンロードの実装を想定している」「Docker コンテナも分けているはず」という情報があり、方針が定まった。

**コンテナは既に分かれているが、イメージは共用**である点を実測で確認した（`app` / `worker` の両コンテナで `ls /app/src` が完全に一致）。[`docker-compose.yml`](../../docker/docker-compose.yml) の 2 サービスは同じ `target: dev` から作られ、違うのは `command:` だけ。

これを受けて [standalone 化の設計上の論点](TODO_補足.md#standalone-化の設計上の論点) の結論を **A（worker を本番イメージから外す）から B（ステージを分ける）へ変更**した。worker に実ジョブを載せるならイメージ分離はどのみち必要で、分離すれば app 側は worker を気にせず standalone にできる。**standalone 化はその分離とセットで着手する**ことにし、[残っているタスク](TODO.md#残っているタスク) へ差し戻した。

**6. 実行したコマンド**

```powershell
# PR #8
git checkout -b chore/slim-docker-runner-image
docker build -f docker/Dockerfile --target runner -t contract-app:before .   # 1.73GB
# Dockerfile 修正 → 再ビルド → 1.31GB
docker run -d --name app-slim-check -p 3100:3000 -e DATABASE_URL='...' ... contract-app:after
pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm build          # すべて成功
gh pr create --base main --head chore/slim-docker-runner-image
gh pr merge 8 --squash --delete-branch

# PR #9
git checkout -b chore/worker-env-file-if-exists
gh pr merge 9 --squash --delete-branch
```

`package.json` を編集する際、**JSON にコメントを書こうとして 1 度失敗した**（`// ...` は構文エラー）。意図はコミットメッセージと PR 本文に書くこと。

また、`.env` を一時退避して「クローン直後」を再現しようとしたが、**権限設定でブロックされた**（`.env` は保護対象）。代わりに**元から `.env` を持たない本番イメージ**で同じコマンド形（`tsx watch --env-file-if-exists=.env`）を実行して検証した。**保護されたファイルを動かさずに済む検証経路を探すこと。**

**7. 更新したドキュメント**

[`README.md`](../../README.md) は 2 か所。「環境変数ファイルを作成する」の `.env` 必須の但し書き（PR #9）と、「本番デプロイ」節のサービス構成（`pnpm start` → 実際の起動コマンド）。`README_SIMPLE.md` は本番手順を扱わず、`.env` を必須と書いてもいないため変更なし。

## 2026-08-03 VSCode デバッグ環境の整備

Cloud Run 構築（当時の `残作業3`。2026-08-04 に完了し [完了済みの作業](TODO.md#完了済みの作業) へ移動）へ進む前に、**ローカルで処理を 1 行ずつ追える環境**を用意した。PR #10。手順の正本は [`README.md`](../../README.md#vscodeでステップイン実行するデバッグ) に置き、ここには経緯と実測値だけを残す。

**1. 方針の決定**

ユーザーから「新人でも分かるように説明してほしい」という要望があり、**起動型（VSCode がプログラムを起動）と接続型（起動済みコンテナへ後から接続）の違い**から説明したうえで方針を選んでもらった。結論は次の 2 つ。

| 論点 | 決定 | 理由 |
|---|---|---|
| 対象 | **両方**（`PC:` と `Docker:` の 2 系統） | 普段は Docker で動かしていても、止めたいときだけ PC 上で直接起動するほうが速い場面が多い |
| `.vscode` の扱い | **Git 管理下に置く** | `launch.json` は個人のフォント設定ではなく「このプロジェクトの動かし方」。テンプレートの流用先でもそのまま使えるべき |

`.gitignore` は `.vscode/` の全除外から **`.vscode/*` 除外 + `launch.json` / `extensions.json` だけ許可**へ変更した。

**2. 実測で判明した落とし穴 その1: app の接続先は 9229 ではなく 9230**

`NODE_OPTIONS: "--inspect=0.0.0.0:9229"` を compose に置いたが、**この変数はコマンドが起動する Node プロセスすべてに効く**。コンテナ内では `pnpm`（corepack）が先に起動するため 9229 を占有し、Next.js は実サーバを 1 つ後ろのポートへずらしていた。

```
app-1  | Debugger listening on ws://0.0.0.0:9229/...
app-1  | Starting inspector on 0.0.0.0:9229 failed: address already in use
app-1  | Debugger listening on ws://0.0.0.0:9230/...
app-1  | - Debugger port: 9230
```

どちらが本体かは `/json/list` で確定できる。**ポート番号ではなくプロセスの実体を見ること。**

```powershell
curl -s http://localhost:9229/json/list   # → /usr/local/bin/pnpm（corepack の pnpm.js）
curl -s http://localhost:9230/json/list   # → next/dist/server/lib/start-server.js ← 本体
```

**3. 実測で判明した落とし穴 その2: worker は NODE_OPTIONS では受付口を持てない**

worker 側は事情が違った。`prisma generate` と `tsx watch` 自身が先に 9229 を取り、**肝心の worker 本体が `address already in use` で弾かれる**（app と違い、tsx は Node のようにポートを自動でずらさない）。

```
worker-1  | Starting inspector on 0.0.0.0:9229 failed: address already in use
worker-1  | [06:56:48] INFO: worker 起動完了: pg-boss ready
```

`NODE_OPTIONS` をやめ、**tsx の引数として渡す**形に変えて解決した。tsx watch は Node フラグを実行側の子プロセスへ渡すため、これなら本体に付く。

```yaml
command: sh -c "pnpm prisma generate && pnpm exec tsx watch --inspect=0.0.0.0:9229 --env-file-if-exists=.env src/worker/index.ts"
```

**同じ設定方法が 2 つのサービスで通用しなかった。** デバッガの受付口は「どのプロセスが最初に起動するか」に左右されるため、サービスごとに起動ログで確認すること。

**4. ブレークポイントが効く根拠を、VSCode を開く前に取った**

エージェント側は VSCode の UI を操作できないため、**CDP（Chrome DevTools Protocol）で直接コンテナのデバッガへ接続**し、アプリのソースが認識されているかを確認した（使い捨てスクリプトはスクラッチパッドに置き、リポジトリには残していない）。

| 対象 | スクリプトの URL | ソースマップの参照先 |
|---|---|---|
| app | `webpack-internal:///(rsc)/./src/app/api/health/route.ts` | `/app/src/app/api/health/route.ts` |
| worker | `file:///app/src/worker/index.ts` | 同上（`/app/...`） |

**参照先が `/app/...` の絶対パスであることが決め手**で、`launch.json` の `localRoot` / `remoteRoot` でそのまま解決できると確定した（ここが合わないとブレークポイントが灰色のまま反応しない）。その後ユーザーの実機で、`/api/health` とログイン処理（Server Action → `authorize` → `verifyCredentials`）の停止まで確認済み。

**5. 付随して分かったこと**

- **Prettier は JSONC のコメントを保持する。** `.vscode/launch.json` は `pnpm format:check` の対象で最初は失敗したが、`--write` で整形してもコメント 31 個はすべて残った。VSCode 設定ファイルにコメントを書いても CI と衝突しない
- **`next-env.d.ts` は dev サーバ実行で書き換わる**（`./.next/types/routes.d.ts` → `./.next/dev/types/routes.d.ts`）。検証で `pnpm dev` を動かした副作用なので、コミットからは外した。**動作確認の後は `git status` に無関係な差分が混ざっていないか見ること**
- Git Bash には `pkill` が無い。検証で起動した dev サーバは `Get-NetTCPConnection -LocalPort 3001` → `Stop-Process` で止めた

**6. 実行したコマンド**

```powershell
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"   # 停止していたため起動
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml up -d app worker        # ports 変更の反映には再作成が必要

# PC 直接実行側の検証（DB は Docker の db を使用）
node --import tsx --env-file-if-exists=.env src/worker/index.ts     # pg-boss 待受まで到達
node --import tsx --env-file-if-exists=.env prisma/seed.ts          # Seed 完了
node node_modules/vitest/vitest.mjs run --no-file-parallelism --testTimeout=0 src/modules/auth/rbac.test.ts   # 3 passed
pnpm exec next dev --port 3001                                     # /api/health が ok

pnpm lint; pnpm format:check; pnpm typecheck; pnpm test            # すべて成功
git switch -c chore/vscode-debug
gh pr create --base main --head chore/vscode-debug
gh pr merge 10 --squash --delete-branch                            # main = 3b48fba
```

**7. 更新したドキュメント**

[`README.md`](../../README.md) に「VSCodeでステップイン実行する（デバッグ）」節を新設した（構成一覧、PC 直接実行と Docker 接続それぞれの手順、ポートの対応表、止まらないときの対処）。[`README_SIMPLE.md`](../../README_SIMPLE.md) には 2 系統の違いだけを 5 行で書き、詳細は README へリンクしている（初学者向けの最小手順に留める方針のため）。

## 2026-08-04 Cloud Run の構築とログイン不能バグの修正

**最後の残作業だった [Cloud Run 構築](TODO.md#完了済みの作業) を完了し、本番稼働に到達した。** 併せて**本番でしか露見しないバグを 1 件発見して修正**している（PR #11 / `main` = `a8181bd`）。画面ごとの設定値と落とし穴は [Cloud Run のサービス作成画面](TODO_補足.md#cloud-run-のサービス作成画面) / [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因) に集約したので、ここには経緯と判断だけ残す。

**1. 着手前にコード側を実測で固めた**

ブラウザ作業に入る前に、本番イメージが今も通ることと**実行時メモリ**を測った。Cloud Run のメモリ設定を勘で決めないためで、結果は **77MB**。既定の 512MiB に対して 6 倍以上の余裕があり、**1GiB へ上げない根拠**になった（無料枠は「メモリ量 × CPU 割り当て秒」で消費されるため、1GiB にすると減りが 2 倍速くなる）。

```powershell
docker build -f docker/Dockerfile --target runner -t contract-app:verify .   # 1.31GB
docker run -d --name app-verify -p 3100:3000 -e DATABASE_URL='...' ... contract-app:verify
docker stats app-verify --no-stream --format "MEM: {{.MemUsage}} ({{.MemPerc}})"
# → MEM: 77.07MiB / 7.621GiB (0.99%)
```

**TODO に無かった設定を 1 つ足した。** 「**インスタンスの最大数を 2 にする**」。既定は空欄（＝100）で、想定外のアクセスが来ると 100 本まで自動増加して Always Free を突き抜ける。最小 0 の設定ばかり注目していたが、**課金事故を防ぐのは最大側**である。

**2. コンソールの UI が事前資料と大きく違った**

エージェント側が用意した手順は「サービスを作成」ボタンを押す前提だったが、**そのボタンは存在しなかった**。現在の Cloud Run は概要ページに「リポジトリの接続」「コンテナのデプロイ」のカードが並ぶ形で、さらにサービス設定とビルド設定が**1 画面に統合**されている。公式ドキュメント（`docs.cloud.google.com`）を先に読んでいたが、それでも画面と一致しなかった。

**この結果、想定していた「2 段階デプロイ」が不要になった。** 新 UI はサービス名とリージョンを入れた時点で**エンドポイント URL を画面に表示する**ため、`AUTH_URL` を最初から設定できる。旧資料にある `https://<service>-<hash>-uc.a.run.app` という形式も現在は使われていない（`https://<service>-<プロジェクト番号>.<region>.run.app`）。

**手順書は画面ごとに確認しながら進めるべきだった。** 一括で全手順を提示したが、実際には 1 画面ごとにスクリーンショットをもらって差分を埋める形に切り替えている。**クラウドコンソールの UI は資料より速く変わる**前提で進めること。

**3. Cloud Build が 2 回連続で失敗した**

どちらも Cloud Run の設定ではなく Cloud Build 側の問題だった。詳細と対処は [Cloud Build が失敗する 2 つの原因](TODO_補足.md#cloud-build-が失敗する-2-つの原因) にある。

| # | エラー | 原因 |
|---|---|---|
| 1 | `403 Permission 'developerconnect.gitRepos...'` | Developer Connect の権限が未反映。トリガー編集画面の「すべて付与」で解決 |
| 2 | `COPY failed: stat package.json: file does not exist` | **ビルドコンテキストが `docker/` になっていた** |

**2 番目が本質的な落とし穴。** Cloud Build の Dockerfile モードは「**Dockerfile のあるディレクトリ＝ビルドコンテキスト**」として扱うが、[`docker/Dockerfile`](../../docker/Dockerfile) はリポジトリルートがコンテキストである前提で書かれている（`COPY package.json ...`）。**パス指定 `/docker/Dockerfile` 自体は正しく効いており**、Dockerfile の 35 ステップを読み込めていたので、切り分けを誤りやすい。

当初は「`cloudbuild.yaml` をリポジトリに追加する」案を提示したが、**トリガーの構成を見たら既にインライン YAML だった**ため不要になった。その場で `docker` → `'.'` に直すだけで済んでいる。**推測でコードを足す前に、既にある設定を見ること。**

**「ビルドを再試行」では直らない。** このボタンは**そのビルドが走った時点の構成のスナップショット**を再利用するため、トリガーの YAML を直しても反映されない。所要時間が前回とほぼ同じ（16 秒）で同じ行で落ちたのが手がかりだった。**Cloud Build → トリガー → 「実行」** で手動実行すること。

**4. 本番でログインできず、アプリのバグが見つかった（PR #11）**

デプロイ成功後、`/api/health` も `/api/health?check=db` も 200 で返るのに、**ブラウザからログインすると画面がログイン画面に戻り続けた**。

切り分けの経過を残す。**遠回りした部分も含めて書く**（同じ順で疑うと速いため）。

| # | 調べたこと | 結果 |
|---|---|---|
| 1 | 誤パスワードで `/api/auth/callback/credentials` を叩く | 302 → `/login?error=CredentialsSignin`。**リダイレクト先が正しい本番ホスト名**なので `AUTH_URL` / `AUTH_TRUST_HOST` は正常と確定 |
| 2 | 正しいパスワードで同上 → `/api/auth/session` | **ユーザー情報が返る**。認証もセッション Cookie も正常 |
| 3 | Cookie 付きで各パスを GET | `/settings/password` は **200**。サーバ側は完全に正常 |
| 4 | RSC ヘッダ付きで再確認 | やはり 200。再現しない |
| 5 | ブラウザの DevTools（Preserve log 有効） | **`POST /settings/password` が 303 を返している**ことを確認 |

**5 番で確定した。** Request Method が **POST**、Content-Type が `text/x-component`、応答に `X-Action-Redirect: .../;push` があった。つまり**ログインの Server Action が `/settings/password` へ送られている**。

原因は [`proxy.ts`](../../src/proxy.ts) が Server Action の POST をリダイレクトしていたこと。**middleware がリダイレクトを返すと POST はそのまま転送先へ再送される**ため、`signIn` 直後に「`/` → `/settings/password` → `/` → …」と往復が終わらなくなっていた。

```
ログインの Server Action (POST) → signIn 成功 → "/" へ
  → proxy が mustChangePassword を見て /settings/password へリダイレクト
    → POST が /settings/password へ再送され、アクションが再実行される
      → また "/" へ戻される → 以下ループ
```

**ローカルで気づけなかった理由も判明した。** このバグは `mustChangePassword: true` のユーザーでしか起きないが、**ローカルの admin は過去の検証で既に `false` になっていた**。再現のため DB を直接 `true` へ戻したところ、本番と同じ症状が出た。**「本番固有の問題」に見えても、まず手元で同じ状態を作れないか試すこと。**

**5. 修正の設計判断（PR #11）**

「案内」と「認可」を分け、**案内だけを GET 限定**にした。

| ガード | 扱い | 理由 |
|---|---|---|
| ログイン済みで `/login` → `/` | **GET 限定へ** | 利便のための案内 |
| 初回 PW 変更 → `/settings/password` | **GET 限定へ** | 同上 |
| 未ログイン時のガード | **変更なし** | 緩めると未認証のまま業務処理へ届く |
| `/admin/*` の認可 | **変更なし** | 緩めると権限のない人が管理機能を叩ける |

判定ロジックは [`route-guard.ts`](../../src/modules/auth/route-guard.ts) の純粋関数 `decideRedirect` へ切り出した。**middleware のままだとテストのために `NextRequest` を組み立てる必要がある**が、ただの関数なら「この状況ならこう返る」を 1 行で書ける。回帰テスト 12 件を追加（テスト 26 → 38）。

**検証は「直したい挙動」と「壊したくない挙動」の両方を見た。**

| リクエスト | 修正前 | 修正後 |
|---|---|---|
| `GET /` | 307 → `/settings/password` | 307 → `/settings/password`（維持） |
| **`POST /`（`next-action` ヘッダ付き）** | **307 → `/settings/password`** | **404・リダイレクトなし** |
| `GET /login` | 307 → `/` | 307 → `/`（維持） |

修正後の 404 はダミーのアクション ID を送っているためで、**middleware がリダイレクトせず Next.js まで届いた証拠**になる。

**6. 本番の admin パスワードは `Admin@123` だった**

ログインできない原因を探る過程で判明した。[`TODO.md`](TODO.md) には「2026-08-02 に `SEED_ADMIN_PASSWORD` を指定して投入済み」と記録していたが、**実際には効いておらず** [`seed.ts`](../../prisma/seed.ts) の既定値のままだった。

さらに **[`seed.ts`](../../prisma/seed.ts) の `upsert` は `update: {}`** なので、**再 seed しても既存ユーザーのパスワードは上書きされない**。復旧には DB を直接更新するしかなく、使い捨てスクリプトを `uploads/`（`.gitignore` 済み）に置いて対処した（作業後に削除済み）。

**ロック機構にも注意が要る。** [`service.ts`](../../src/modules/auth/service.ts) は失敗が閾値に達すると `lockedAt` を立て、**自動解除しない**。当時の閾値は 5 回で、パスワードを探るうちに到達していた。この体験からユーザー判断で**閾値を 20 回へ緩和**している（PR #11）。

**7. ユーザー要望で 3 点を改善した（PR #11 の 2 コミット目）**

ログイン不能が直って初回パスワード変更画面まで到達できるようになり、実際に触って出てきた要望。

| # | 内容 | 実装 |
|---|---|---|
| 1 | パスワード欄に目のアイコンを付ける | ログイン画面にだけあった実装を [`shared/ui/password-input.tsx`](../../src/shared/ui/password-input.tsx) へ**共通化**し、変更画面の 3 欄へ適用。コピーせず切り出したので、片方だけ直し忘れる事故が起きない |
| 2 | ロック閾値 5 → 20 回 | [`env.ts`](../../src/shared/config/env.ts) の既定値。`.env.example` / `foundation_plan.md` も揃えた |
| 3 | 初回変更画面でサイドバーを出さない | [`(main)/layout.tsx`](<../../src/app/(main)/layout.tsx>) が `mustChangePassword` を見て中央寄せの単独画面に切り替える。proxy がこの間の遷移をすべて戻すため、出しても押せるリンクが無い |

3 番目は**「初回のときだけ」**である点を検証に含めた（変更後の再ログインでサイドバーが戻ることまで確認）。

**8. 自動デプロイの確認（残作業3 の最終項目）**

PR #11 のマージがそのまま検証になった。**反映の判定は JS チャンク名で行う。**

```powershell
$l=(Invoke-WebRequest "$base/login" -UseBasicParsing).Content
([regex]::Matches($l,'/_next/static/chunks/[a-z0-9_\-]+\.js') | ForEach-Object { $_.Value }) | Select-Object -Unique
# → 新しいチャンク 1p1cuvawk3f73.js が出現、旧 3i8cgd-nq-ee8.js が消滅
```

**CSS のハッシュでは判定できなかった。** 最初は CSS で見ようとしたが変化しない。Tailwind は**使用クラスの集合から CSS を生成する**ため、既存クラスしか使わない変更ではハッシュが変わらない。

**9. 実行したコマンド**

```powershell
# 事前検証
docker build -f docker/Dockerfile --target runner -t contract-app:verify .
docker stats app-verify --no-stream --format "MEM: {{.MemUsage}}"    # 77MB

# バグの再現（ローカルの本番ビルド）
$env:DATABASE_URL='postgresql://app:password@localhost:5432/app_db'
pnpm exec tsx uploads/reset-admin-password.ts                        # mustChangePassword を true へ
pnpm build
$env:AUTH_URL='http://localhost:3100'; pnpm exec next start -p 3100  # 3000 は docker compose が使用中
# POST / に next-action ヘッダを付けて 307 を確認 → 修正 → 404 を確認

pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm build  # すべて成功（38 tests）
git checkout -b fix/proxy-server-action-redirect-loop
gh pr create --base main --head fix/proxy-server-action-redirect-loop
gh pr edit 11 --title "..." --body @'...'@                           # 追加コミット後に説明を更新
gh pr merge 11 --squash --delete-branch                              # main = a8181bd
Remove-Item uploads/reset-admin-password.ts                          # 使い捨てスクリプトを削除
```

**ポート 3000 が空いていなかった。** docker compose の開発環境が使っていたため、止めずに 3100 で起動した。`$env:AUTH_URL` で上書きすれば URL 不一致は起きない（既存の環境変数が `.env` より優先されるため）。

**10. 更新したドキュメント**

[`src/AGENTS.md`](../../src/AGENTS.md) に「**middleware から Server Action の POST をリダイレクトしない**」を規約として追記した（PR #11 に同梱）。同じ設計ミスを次に繰り返さないための、最も効く置き場所だと判断したため。
