# 02.1 手順1 GitHub リポジトリを用意する

手順1。リポジトリ作成・初回 push・CI の確認・ブランチ保護。

インフラ構築手順書の一部。全体の目次と進め方は [`README.md`](README.md) を見ること。


所要時間の目安: 30 分。

> 画面が本書と異なる場合は [00.1.6](infra_design_00_概要と全体構成.md#0016-uiは資料と異なる可能性あり) を参照してください。

## 02.1.1 コミットの署名を設定する

Git は、コミット（変更の記録）に名前とメールアドレスを埋め込みます。**会社アカウントと個人アカウントを使い分けている場合は、このリポジトリだけの設定を入れてください。**

```powershell
git init -b main
git config --local user.name  "<GitHubのユーザー名>"
git config --local user.email "<GitHubのメールアドレス>"
```

`--local` はこのリポジトリの `.git/config` にだけ書き込まれ、PC 全体の設定（`--global`）より優先されます。**他のリポジトリには影響しません。**

> **メールアドレスの選び方**: GitHub が発行する `<ID>+<ユーザー名>@users.noreply.github.com` 形式のアドレスを使うと、実際のメールアドレスを履歴に残さずに済みます。GitHub の Settings → Emails で確認できます。

## 02.1.2 登録してはいけないファイルを確認する

```powershell
git add -A
git status --short
```

一覧に次のファイルが含まれていないことを確認してください。含まれている場合は [`.gitignore`](../../../.gitignore) を見直します。

| ファイル            | 理由                                               |
| --------------- | ------------------------------------------------ |
| `.env`          | パスワードや秘密鍵が書かれています                                |
| `node_modules/` | 容量が大きく、`pnpm install` で復元できます                    |
| `.next/`        | ビルドの生成物です                                        |
| 案件固有の資料         | 実在するサーバー情報・IP アドレス・アカウント ID などを含む資料は、除外を検討してください |

## 02.1.3 コミット前に検査を通す

GitHub へ登録する前に、PC 上で CI と同じ検査を実行します。ここで失敗を潰しておくと、後の工程がスムーズです。

```powershell
pnpm lint
pnpm format:check
pnpm typecheck
pnpm exec prisma validate
pnpm test
pnpm build
```

すべて成功したらコミットします。

```powershell
git commit -m "chore: 初回コミット"
```

## 02.1.4 GitHub へ登録する

```powershell
gh repo create <リポジトリ名> --private --source=. --remote=origin --push
```

**このプロジェクトでの例**: リポジトリ名は `multi-ai-agent-sample`、公開設定は private。

> **push（プッシュ）**とは、PC 上の変更を GitHub へ送信することです。

### 発生しやすいエラー: `workflow` スコープ不足

次のエラーで push だけが失敗する場合があります。

```
! [remote rejected] HEAD -> main
  (refusing to allow an OAuth App to create or update workflow `.github/workflows/ci.yml` without `workflow` scope)
```

GitHub は `.github/workflows/` 配下（自動処理の定義）を特別扱いしており、**`workflow` という権限を持つ資格情報でしか登録できません**。次の 2 行で解決します。

```powershell
gh auth refresh -h github.com -s workflow
git -c credential.helper= -c credential.helper="!gh auth git-credential" push -u origin main
```

> **2 行目が必要な理由**: Windows では Git Credential Manager という別の仕組みが資格情報を管理しており、`gh auth refresh` で権限を追加しても、そちらの情報は古いままです。2 行目は「このコマンドの実行中だけ、`gh` の資格情報を使う」という指定で、設定ファイルは書き換えません。

## 02.1.5 CI が動くことを確認する

`main` への push をきっかけに、GitHub Actions の検査が自動で始まります。

```powershell
gh run list --limit 3
```

`completed  success  CI` のように表示されれば成功です。ブラウザで確認する場合は、リポジトリの `Actions` タブを開きます。

検査の内容は [`.github/workflows/ci.yml`](../../../.github/workflows/ci.yml) にあり、次の 8 つを順に実行します。

1. `pnpm lint` — 書き方の問題を検出
2. `pnpm format:check` — 書式の統一を確認
3. `prisma validate` — データベース定義の検証
4. `prisma generate` — データベース操作コードの生成
5. `pnpm typecheck` — 型の矛盾を検査
6. `prisma migrate deploy` — **空のデータベースから構造を再現できることの検証**
7. `pnpm test` — 単体テスト
8. `pnpm build` — 本番ビルド

> **CI（継続的インテグレーション）**とは、変更のたびに自動で検査を実行し、問題を早期に見つける仕組みです。

## 02.1.6 ブランチ保護を設定する

> **ブランチ保護**とは、`main` ブランチへの変更に条件を付ける GitHub の機能です。「CI が成功していなければマージできない」「直接 push できない」といった制限を、**仕組みとして強制**できます。

**`main` の更新はそのまま本番へ反映されるため、本番運用では設定することを推奨します。**

### 推奨する設定

Settings → Branches → **Add branch protection rule** で、対象を `main` として次を有効にします。

| 設定項目                                                               | 効果                                           |
| ------------------------------------------------------------------ | -------------------------------------------- |
| **Require a pull request before merging**                          | `main` への直接 push を禁止し、必ず Pull Request を経由させる |
| **Require status checks to pass before merging**（対象に `verify` を指定） | **CI が成功していない Pull Request をマージできなくする**      |

### 設定できない場合

private リポジトリでこの機能を使うには、**GitHub Pro（有料）またはリポジトリの public 化**が必要です。設定していない状態で `gh` から確認すると、次のように表示されます。

```powershell
gh api repos/<ユーザー名>/<リポジトリ名>/branches/main/protection
# → Upgrade to GitHub Pro or make this repository public to enable this feature. (HTTP 403)
```

選択肢は 3 つあります。

| 選択肢               | 費用  | 判断の目安                                                                      |
| ----------------- | --- | -------------------------------------------------------------------------- |
| GitHub Pro を契約する  | 有料  | **複数人で開発する本番運用ではこれを推奨**                                                    |
| リポジトリを public にする | 無料  | 公開して問題ない内容か十分に確認する必要がある。Public リポジトリは誰でも閲覧できるため、ソースコードや設定情報が全世界に公開される点に注意。 |
| 設定せず、運用ルールで守る     | 無料  | 少人数・検証段階であればこの選択も成り立つ                                                      |

**このプロジェクトでの例**: 検証段階のため 3 番目（運用ルール）を選び、[`docs/todo/TODO.md`](../../todo/TODO.md) に検討課題として記録しています。

### 設定しない場合に受け入れるリスク

3 番目を選ぶ場合は、次の 2 点が**仕組みでは防げない**ことを理解したうえで運用します。

| リスク                 | 起こること                 | 運用でどう防ぐか                             |
| ------------------- | --------------------- | ------------------------------------ |
| CI が失敗していてもマージできる   | 検査を通っていないコードが本番へ反映される | マージ前に必ず CI の結果を確認する                  |
| `main` へ直接 push できる | レビューを経ないコードが本番へ反映される  | コードの変更は必ず作業用ブランチと Pull Request を経由する |

いずれの場合も、問題のある内容を反映してしまったときは元の状態へ戻せます（[07.1.5](infra_design_07_構築後の運用.md#0715-以前の状態へ戻す切り戻し)）。

> **ドキュメント（`.md` / `docs/` 配下）のみの変更は、`main` へ直接コミットしてよい**という例外を設けています。アプリの動作に影響しないためです。詳細は [`gitの操作ルール.md`](../../development/gitの操作ルール.md#ドキュメントだけの変更でciを実行しないmainへ直接push) を参照してください。

手順は [`gitの操作ルール.md`](../../development/gitの操作ルール.md) にあります。
