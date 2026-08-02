# TODO 作業履歴

[`TODO.md`](TODO.md) から分離した、セッションごとの作業記録（旧「引き継ぎメモ」）。
**新しいセッションほど上**に並べている。残タスクの一覧は本編、手順や設定値の詳細は [`TODO_補足.md`](TODO_補足.md) を見ること。

ここに書くのは「何をやったか」「なぜそうしたか」「どこで詰まったか」の 3 つ。同じ落とし穴を次のセッションが踏まないようにするための記録なので、**うまくいかなかった過程も残す**。

## 目次

| セッション | 主な内容 |
|---|---|
| [2026-08-02 本番 DB の構築と Storage の疎通確認](#2026-08-02-本番-db-の構築と-storage-の疎通確認) | migrate / seed の実行、`apikey` ヘッダ不足のバグ発見と PR #6 |
| [2026-08-02 開発フローの README 化と CI のスキップ設定](#2026-08-02-開発フローの-readme-化と-ci-のスキップ設定) | PR 運用の README 化、`paths-ignore` と `[skip ci]` の 2 段構え |
| [2026-08-02 PR 運用の開始と CI の順序バグ修正](#2026-08-02-pr-運用の開始と-ci-の順序バグ修正) | PR #1 / #2、Prisma generate の順序バグ、Actions 更新 |
| [2026-08-01 スキル基盤の整備](#2026-08-01-スキル基盤の整備) | `update-todo` を 3 エージェント共通で追加 |
| [2026-08-01 Supabase セットアップ](#2026-08-01-supabase-セットアップ) | プロジェクト作成、Session pooler の取得 |
| [2026-08-01 GitHub と CI](#2026-08-01-github-と-ci) | 初回 push、`workflow` スコープ不足、初回 CI |
| [2026-07-28 Git の初期化とコミット前チェック](#2026-07-28-git-の初期化とコミット前チェック) | 署名の分離、機密資料の除外、ローカル CI 相当 |

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

メジャー 3 世代跨ぎのため各リリースノートを確認したが、**本プロジェクトに影響する破壊的変更はなかった**（詳細は [`TODO.md`](TODO.md#積み残しと検討事項) の該当項目）。更新後の CI は 1m19s で success、**非推奨警告は 0 件**になった。

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

## 2026-08-01 Supabase セットアップ

**1. Supabase プロジェクトを作成**

GitHub アカウントでサインアップし、**East US (North Virginia)** でプロジェクトを作成した。作成画面での判断（Data API オフ、GitHub 連携なし、automatic RLS オフ）とその理由は [プロジェクト作成画面の設定](TODO_補足.md#supabase-プロジェクト作成画面の設定) に整理してある。**リージョンは作成後に変更できない**ため、作り直す場合はここを最優先で確認すること。

**2. Session pooler の接続文字列を取得**

Connect ダイアログの UI が紛らわしく、既定の Framework タブ（`supabase-js` 向け）や ORM タブ（Transaction pooler + `directUrl` 前提で本プロジェクトでは動かない）に誘導されやすい。歩き方と Session pooler の見分け方は [Connect ダイアログの歩き方](TODO_補足.md#connect-ダイアログの歩き方) に整理した。取得した文字列は `aws-0-us-east-1.pooler.supabase.com:5432` / ユーザー `postgres.<プロジェクトref>` の形式で、条件を満たしていることを確認済み。

**3. 本番 DB への適用手順を確定**（実行はこれから）

コマンドは [本番 DB への適用手順](TODO_補足.md#本番-db-への適用手順) に 1 行ずつコピーできる形で記載した。**PowerShell ではシングルクォート必須**（ダブルクォートだとパスワード中の `$` が変数展開される）という落とし穴があるため、手順側に明記している。

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
