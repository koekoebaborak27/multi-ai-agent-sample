# 汎用契約管理システムテンプレート

**無料枠（Google Cloud Run + Supabase）で動かせる、様々な案件に流用できる契約管理システムのテンプレート。マルチAIエージェント開発にも対応。**

- アーキ: Next.js 16 App Router（feature-modular / lite-DDD）、Prisma、PostgreSQL、pg-boss（ジョブ）、shadcn/ui + Tailwind v4
- 認証 / 認可: Auth.js v5（Credentials 必須 + Microsoft Entra ID は任意）、Argon2id によるパスワードハッシュ、`src/proxy.ts` でのロールベース認可
- 入力検証 / フォーム: Zod v4 + react-hook-form / **ログ**: pino（構造化ログ） / **CSV**: papaparse
- CI: GitHub Actions（lint / format / typecheck / Prisma 検証 / test / build） / デプロイ: Google Cloud Run（GitHub 連携の自動デプロイ）
- 開発は **GitHub Copilot / Claude Code / Codex のいずれでも進められる**マルチAIエージェント構成（→ [AIエージェントによる開発](#aiエージェントによる開発マルチaiエージェント構成)）
- 設計の正本は [`docs/foundation_plan.md`](docs/foundation_plan.md)

## 主な機能

テンプレートとして、以下の画面・機能が実装済みです。案件固有の業務ドメインは `src/modules/` へ追加していきます。

| 画面 | パス | モジュール | 内容 |
|---|---|---|---|
| ログイン | `/login` | [`src/modules/auth/`](src/modules/auth/) | Credentials（ID/PW）認証。Entra ID は環境変数が揃うと追加表示 |
| ダッシュボード | `/` | [`src/modules/announcement/`](src/modules/announcement/) | 最新のお知らせ一覧 |
| 契約管理 | `/contracts` | [`src/modules/contract/`](src/modules/contract/) | 契約の一覧（ページング）・登録・編集・削除 |
| 契約先管理 | `/parties` | [`src/modules/party/`](src/modules/party/) | 契約先の一覧（ページング）・登録・編集・削除 |
| ユーザー管理 | `/admin/users` | [`src/modules/user/`](src/modules/user/) | ユーザーの一覧・登録・編集・削除（**ADMIN 限定**） |
| パスワード変更 | `/settings/password` | [`src/modules/auth/`](src/modules/auth/) | 初回ログイン時は変更するまで他画面へ進めない |
| マスタ管理 | `/master` | — | プレースホルダ（案件ごとに実装する想定） |

加えて、横断機能として認証セッション（`src/shared/auth/`）、DB 接続（`src/shared/db/`）、ジョブキュー（`src/shared/jobs/` + `src/worker/`）、ファイルストレージ抽象（`src/shared/storage/`）、構造化ログ（`src/shared/observability/`）、UI コンポーネント（`src/shared/ui/`）を用意しています。

## はじめてローカル環境を構築する

**アプリ・ジョブワーカー・PostgreSQL の3つをすべて Docker で起動します。** PC へ PostgreSQL を直接インストールする必要はありません。

より短い手順だけを知りたい場合は [`README_SIMPLE.md`](README_SIMPLE.md) を参照してください。Docker を使わずホスト上で直接動かす方法は「[補足: ホスト上で直接動かす](#補足-ホスト上で直接動かす)」にあります。

### 1. 必要なソフトウェアをインストールする

以下を事前にインストールしてください。

| ソフトウェア | 用途 | 必要なバージョン |
|---|---|---|
| [Git](https://git-scm.com/downloads) | ソースコードの取得と変更履歴の管理 | 最新の安定版を推奨 |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | アプリ・ワーカー・PostgreSQL をコンテナとして起動 | 最新の安定版を推奨 |
| [Node.js](https://nodejs.org/) | エディタの補完と、lint / 型チェックなどの検査コマンドの実行 | 22（LTS） |
| pnpm | Node.jsの依存パッケージをインストール・管理 | 10.15.1 |

> **コンテナ**とは、アプリケーションやPostgreSQLなどのソフトウェアと、その実行に必要な設定をひとまとめにした実行環境です。このプロジェクトでは、PCへ直接インストールせず、Docker Desktop内で動かします。

アプリ本体は Docker コンテナ（[`docker/Dockerfile`](docker/Dockerfile) の `node:22` ベース）で動くため、PC 側の Node.js は検査コマンドとエディタ補完のために使います。バージョンは Docker 側と揃えて 22 を推奨します。リポジトリ直下の [`.nvmrc`](.nvmrc) に `22` を記載しているので、nvm / fnm などのバージョン管理ツールを使っている場合は `nvm use`（fnm は `fnm use`）で切り替えられます。

Node.jsをインストールした後、PowerShell、コマンドプロンプト、またはターミナルで次のコマンドを実行し、pnpmを有効にします。Corepackは、使用するpnpmのバージョンをプロジェクトごとに管理するためのNode.js付属ツールです。

```bash
corepack enable
corepack prepare pnpm@10.15.1 --activate
```

インストール結果を確認します。各コマンドでバージョン番号が表示されれば準備完了です。

```bash
git --version
node --version
pnpm --version
docker --version
docker compose version
```

Node.jsは`v22.x`、pnpmは`10.15.1`が表示されることを確認してください。また、Dockerのコマンドを実行する前にDocker Desktopを起動してください。

### 2. プロジェクトへ移動して依存パッケージをインストールする

Gitで取得済みのプロジェクトのルートディレクトリへ移動します。ルートディレクトリとは、この`README.md`や`package.json`が置かれているディレクトリです。

```bash
cd <このプロジェクトを配置したディレクトリ>
pnpm install
```

> **依存パッケージ**とは、このアプリケーションが利用するNext.js、Prisma、Auth.jsなどの外部ライブラリです。`pnpm install`は、`package.json`と`pnpm-lock.yaml`に記録されたバージョンを基に、それらをPCへダウンロードします。

コンテナ内にも独立した`node_modules`が作られるため、この手順は主にエディタの補完と`pnpm lint` / `pnpm typecheck`をPC上で実行するためのものです。

### 3. 環境変数ファイルを作成する

環境変数は、データベースの接続先や認証に使う秘密情報など、実行環境ごとに変わる設定値です。サンプルファイル`.env.example`をコピーして、ローカル用の`.env`を作成します。

Windows PowerShellの場合:

```powershell
Copy-Item .env.example .env
```

macOSまたはLinuxの場合:

```bash
cp .env.example .env
```

**ローカルをDockerで動かす場合、`.env`は初期値のままで構いません。** `app`と`worker`の接続情報は[`docker/docker-compose.yml`](docker/docker-compose.yml)が注入し、その値が`.env`より優先されます。`worker`は`--env-file-if-exists`で起動するため、`.env`が無くても`docker compose`は動きます（ホスト上で`pnpm dev`を実行する場合は`.env`が必要です）。

ホスト上で直接`pnpm dev`を実行する場合は、`.env`の`AUTH_SECRET`を推測されにくい長いランダム文字列へ変更してください。`AUTH_SECRET`は、ログイン情報の改ざんを防ぐ署名に使用する秘密鍵です。`.env`には秘密情報が含まれるため、Gitへコミットしないでください。

ランダム文字列は、例えば次のいずれかで生成できます。

```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

```bash
# macOSまたはLinux
openssl rand -base64 32
```

Microsoft Entra IDとSupabaseに関する環境変数は任意であり、通常のローカル起動では空欄のままで構いません。各項目の詳しい意味は`.env.example`のコメントと[`src/shared/config/env.ts`](src/shared/config/env.ts)を参照してください。

### 4. アプリケーション一式を起動する

Docker Desktopが起動していることを確認してから、次のコマンドを実行します。

```bash
docker compose -f docker/docker-compose.yml up -d
```

これにより、[`docker/docker-compose.yml`](docker/docker-compose.yml)の3つのサービスがバックグラウンドで起動します。

| サービス | 役割 | 起動時の処理 |
|---|---|---|
| `db` | PostgreSQL 16 | データは`db-data`ボリュームに永続化 |
| `app` | Next.js 開発サーバ（http://localhost:3000） | `prisma generate` → `prisma migrate deploy` → `next dev` |
| `worker` | pg-boss ジョブワーカー | `prisma generate` → `tsx watch` でソース変更時に自動再起動 |

**`app`はマイグレーションを自動で適用する**ため、手動でのマイグレーション実行は不要です。ソースコードはバインドマウントされており、PC側で編集するとそのままコンテナへ反映されます。

> **マイグレーション**とは、テーブルや列などのデータベース構造を、プロジェクトで定義された最新の状態へ変更する処理です。`prisma migrate deploy`は`prisma/migrations/`に保存された変更履歴を適用します。

初回はDockerイメージのビルドと依存パッケージの取得のため、数分かかります。起動状況は次のコマンドで確認します。

```bash
docker compose -f docker/docker-compose.yml ps
docker compose -f docker/docker-compose.yml logs -f app
```

`app`のログに`Ready`と表示されれば起動完了です（`Ctrl+C`でログ表示を終了しても、コンテナは動き続けます）。

> **補足（Windows）**: Docker Desktop のバインドマウントはファイル変更を inotify で検知できないため、`app`は`WATCHPACK_POLLING`によるポーリング監視と webpack（`next dev --webpack`）で動作します。Turbopack ではこの環境で変更を検知できなかったためです。

### 5. 初期データを投入する

初回のみ実行します。

```bash
docker compose -f docker/docker-compose.yml exec app pnpm prisma:seed
```

> **seed（シード）**とは、動作確認に必要な初期データをデータベースへ登録する処理です。[`prisma/seed.ts`](prisma/seed.ts)は初期管理者とお知らせを登録します。

初期管理者は次の内容で作成されます。

- ログインID: `admin`
- 初期パスワード: `Admin@123`

初期パスワードを変更してseedを実行したい場合は、`SEED_ADMIN_PASSWORD`環境変数を指定してください。この初期管理者は`mustChangePassword`が有効な状態で作成されるため、**初回ログイン後はパスワード変更画面へ自動的に遷移し、変更を完了するまで他の画面を利用できません**。

### 6. 動作を確認する

ブラウザで[http://localhost:3000](http://localhost:3000)を開き、初期管理者でログインできればローカル環境の構築は完了です。

ジョブワーカーのログを確認する場合は次を実行します。

```bash
docker compose -f docker/docker-compose.yml logs -f worker
```

> **ジョブワーカー**とは、画面からのリクエストとは別に、時間のかかる処理や後で実行する処理を担当するプログラムです。

### 7. 開発を終了する

```bash
docker compose -f docker/docker-compose.yml stop
```

再開するときは、手順4の`up -d`を実行します。`stop`ではデータは削除されないため、次回も同じデータを使用できます。

コンテナとネットワークを削除する場合は`down`を、**データベースの中身を含めて完全に消して作り直す**場合は`down -v`を実行します。

```bash
docker compose -f docker/docker-compose.yml down     # コンテナを削除（データは残る）
docker compose -f docker/docker-compose.yml down -v  # ボリュームごと削除（データも消える）
```

### 補足: ホスト上で直接動かす

Next.js の開発サーバを PC 上で直接動かしたい場合は、`db`だけを Docker で起動します。

```bash
docker compose -f docker/docker-compose.yml up -d db   # PostgreSQL のみ起動
pnpm prisma:migrate                                    # マイグレーション適用
pnpm prisma:seed                                       # 初期データ投入（初回のみ）
pnpm dev                                               # 開発サーバ（Ctrl+C で停止）
pnpm worker                                            # ジョブワーカー（必要な場合のみ・別ターミナル）
```

この方法では`.env`の値がそのまま使われるため、`AUTH_SECRET`を必ず設定してください。`DATABASE_URL`は`.env.example`の値（`localhost:5432`）のままで接続できます。

### 補足: A5:SQL Mk-2（A5M2）でデータベースへ接続する

登録されたデータをGUIで確認したい場合は、[A5:SQL Mk-2](https://a5m2.mmatsubara.com/)などのデータベースクライアントから接続できます。

`db`コンテナはポート`5432`をPC側へ公開しているため、**PC上のPostgreSQLへ接続するのと同じ手順**で接続できます（Docker特有の設定は不要です）。

#### 接続情報

[`docker/docker-compose.yml`](docker/docker-compose.yml)の`db`サービスの設定に対応します。

| 項目 | 値 |
|---|---|
| サーバー名（ホスト名） | `localhost` |
| ポート番号 | `5432` |
| データベース名 | `app_db` |
| ユーザーID | `app` |
| パスワード | `password` |
| スキーマ | `public` |

#### 手順

1. `db`コンテナが起動していることを確認します。

   ```bash
   docker compose -f docker/docker-compose.yml ps db
   ```

   `db`の状態が`Up`または`healthy`であれば接続できます。

2. A5:SQL Mk-2 を起動し、メニューの **［データベース］→［データベースの追加と削除］** を開きます。
3. **［追加］** をクリックし、接続タイプの一覧から **［PostgreSQL（直接接続）］** を選択します。
4. 上の接続情報を入力します。毎回入力する手間を省く場合は「パスワードを保存する」にチェックを入れてください（ローカル開発用の値のため保存しても問題ありません）。
5. **［テスト接続］** で成功することを確認し、**［OK］** で保存します。
6. 登録した接続をダブルクリックすると、テーブル一覧が表示されます。

#### テーブル名の大文字小文字に注意

Prisma のモデル名がそのままテーブル名になるため（`@@map`を使わない方針。[`prisma/AGENTS.md`](prisma/AGENTS.md)）、`User`・`Announcement`・`Contract`・`Party`のように**先頭が大文字**です。PostgreSQL は引用符なしの識別子を小文字として扱うため、SQL を直接書く場合は二重引用符で囲む必要があります。

```sql
SELECT * FROM "User";        -- OK
SELECT * FROM Contract;      -- エラー（contract として探されるため見つからない）
SELECT * FROM User;          -- エラー（user は PostgreSQL の予約語）
```

#### 接続できない場合

- `docker compose ... ps db`で`db`が起動しているか確認してください。
- ポート`5432`を別のPostgreSQLが使用していると、そちら側へ接続してしまいます。`docker/docker-compose.yml`でポートを変更している場合は、その値を指定してください。
- 接続情報を変更している場合は、`.env`の`DATABASE_URL`（`postgresql://ユーザーID:パスワード@ホスト:ポート/データベース名`）と一致しているか確認してください。

### セットアップ時によくある問題

#### `docker`コマンドを実行できない

Docker Desktopがインストール済みで、起動が完了しているか確認してください。インストール直後は、PCやターミナルの再起動が必要な場合があります。

#### ポート`5432`が既に使用されている

PCへ直接インストールしたPostgreSQLなど、別のプログラムがポート`5432`を使用しています。そのプログラムを停止してから起動し直すか、[`docker/docker-compose.yml`](docker/docker-compose.yml)の`db`のポート設定を変更してください。

#### ポート`3000`が既に使用されている

別のNext.jsアプリケーションなどが起動しています。そのプログラムを停止するか、`docker/docker-compose.yml`の`app`のポート設定を変更してください。

#### `app`コンテナがマイグレーションで失敗する

`db`の起動完了前に接続しようとした可能性があります。`docker compose ... ps`で`db`が`healthy`であることを確認し、`docker compose ... restart app`で再起動してください。

#### 型エラーが出る／Prismaの型が古い

`prisma/schema.prisma`を変更した後は、Prisma Clientの再生成が必要です。PC側では`pnpm prisma:generate`を実行してください（コンテナ側は起動のたびに自動生成されます）。

#### データベースを初期状態に戻したい

```bash
docker compose -f docker/docker-compose.yml exec app pnpm db:reset
```

## VSCodeでステップイン実行する（デバッグ）

コードを1行ずつ止めながら実行し、そのときの変数の中身を確認できます。デバッグ構成は[`.vscode/launch.json`](.vscode/launch.json)に用意済みのため、追加の準備は不要です。`Ctrl+Shift+D`（実行とデバッグ）を開き、上部の一覧から構成を選んで▶を押します。

> **ステップイン実行**とは、プログラムを指定した行で一時停止させ、そこから1行ずつ進めながら動作を追う方法です。`F11`で呼び出し先の関数の中へ入り、`F10`で関数の中へ入らずに次の行へ進み、`F5`で次の停止位置まで再開します。

構成名の接頭辞は、プログラムをどこで動かすかを表します。**どちらの方式でもステップイン実行の使い勝手は同じ**です。

| 接頭辞 | 起動方法 | 向いている場面 |
|---|---|---|
| `PC:` | VSCodeがプログラムを起動する（起動型） | 動作が安定するため、普段はこちらを推奨 |
| `Docker:` | 起動済みのコンテナへ後から接続する（接続型） | 普段どおり`docker compose`で起動したままデバッグしたい場合 |

### 用意されている構成

| 構成名 | デバッグ対象 | 事前に必要なもの |
|---|---|---|
| `PC: Next.js サーバ側` | Server Component、Route Handler、Server Action、[`src/proxy.ts`](src/proxy.ts) | `db`の起動と`.env` |
| `PC: Next.js ブラウザ側` | `"use client"`が付いたコンポーネント | サーバ側を先に起動しておくこと |
| `PC: Next.js フルスタック（サーバ + ブラウザ）` | 上記2つを同時に起動 | `db`の起動と`.env` |
| `PC: worker（ジョブワーカー）` | [`src/worker/index.ts`](src/worker/index.ts)（pg-boss） | `db`の起動と`.env` |
| `PC: テスト（開いているファイル）` | エディタで開いているテストファイル | なし |
| `PC: テスト（すべて）` | `src`配下のテスト全部 | なし |
| `PC: 初期データ投入（seed）` | [`prisma/seed.ts`](prisma/seed.ts) | `db`の起動と`.env` |
| `Docker: app（Next.js）へ接続` | コンテナ内のサーバ側コード | `docker compose ... up -d` |
| `Docker: worker へ接続` | コンテナ内のジョブワーカー | `docker compose ... up -d` |

### PC上で直接動かしてデバッグする

1. ポート`3000`を空けます。Dockerの`app`が動いている場合は停止してください。

```bash
docker compose -f docker/docker-compose.yml up -d db     # DBだけ起動する
docker compose -f docker/docker-compose.yml stop app     # appが動いていれば停止する
```

2. 止めたい行の行番号の左側をクリックし、赤い丸（ブレークポイント）を置きます。
3. `Ctrl+Shift+D`→`PC: Next.js サーバ側`→▶で起動します。
4. ブラウザでその処理を通る画面を開くと、赤い丸を置いた行で停止します。

`"use client"`が付いたコンポーネントはブラウザ側で動くため、サーバ側の構成では止まりません。両方まとめて扱う場合は`PC: Next.js フルスタック（サーバ + ブラウザ）`を選びます（Chromeが起動します。Chromeを使わない場合は[`.vscode/launch.json`](.vscode/launch.json)の`"type": "chrome"`を`"msedge"`へ変更してください）。

### Dockerコンテナへ接続してデバッグする

普段どおり起動したまま、後からVSCodeを繋ぎます。

```bash
docker compose -f docker/docker-compose.yml up -d
```

ブレークポイントを置き、`Ctrl+Shift+D`→`Docker: app（Next.js）へ接続`→▶を押せば接続完了です。コンテナ側は[`docker/docker-compose.yml`](docker/docker-compose.yml)の`NODE_OPTIONS`でデバッガの受付口を開いており、PC側へは次のポートで公開しています。

| PC側のポート | 中身 |
|---|---|
| `9229` | `pnpm`自身のプロセス。**接続しても意味がありません** |
| `9230` | Next.jsの開発サーバ本体。**`app`の接続先はこちら** |
| `9231` | ジョブワーカー（コンテナ内では`9229`） |

`app`の接続先が`9230`になるのは、コンテナ内で先に起動する`pnpm`が`9229`を使うため、Next.jsが1つ後ろのポートへずれるからです。実際に使われているポートは`docker compose ... logs app`の`- Debugger port:`の行に出力されます。

### ブレークポイントが反応しないとき

| 症状 | 原因と対処 |
|---|---|
| 赤い丸が灰色（白抜き）のまま | そのコードがまだ読み込まれていないだけの場合があります。該当の画面を一度開いてから確認してください |
| 画面を開いても止まらない | サーバ側とブラウザ側を取り違えている可能性があります。`"use client"`が付いたファイルは`ブラウザ側`の構成でしか止まりません |
| `Docker:`構成で接続できない | 接続先のポートを確認してください（`app`は`9229`ではなく`9230`）。`docker compose ... ps`でコンテナが起動しているかも確認します |
| デバッグ中に接続が切れる | コンテナを再作成すると切れます。もう一度▶を押して繋ぎ直してください |
| 変更したコードが反映されない | Windowsではファイル変更をポーリングで検知しているため、反映まで数秒かかります（[補足](#4-アプリケーション一式を起動する)） |

> **ジョブワーカーについて**: 現時点ではジョブが登録されていないため、`worker`で止められるのは起動処理までです。ジョブ処理を追加した後は、その処理にブレークポイントを置けます。

## 認証と権限（RBAC）

- 認証は Auth.js v5。**Credentials（ID/PW）が必須**、Microsoft Entra ID は `AUTH_MICROSOFT_ENTRA_ID_*` が3つとも設定されている場合のみ有効化される任意プロバイダです。
- パスワードは Argon2id（`@node-rs/argon2`）でハッシュ化します。ログイン失敗が`MAX_ATTEMPTS`回（既定 **20 回**）に達したアカウントはロックされます。**ロックは自動解除されません**（`lockedAt`が立ったままになります）。解除するには管理画面から操作するか、DBの`users`テーブルで`lockedAt`を`null`・`failedAttempts`を`0`に戻してください。
- 認証ガードと認可は [`src/proxy.ts`](src/proxy.ts) が担当します（Next.js 16 で `middleware.ts` から改名。Node.js ランタイムで動作）。ロール判定は JWT クレームのみで完結し、DB アクセスは行いません。判定そのものは [`src/modules/auth/route-guard.ts`](src/modules/auth/route-guard.ts) の純粋関数`decideRedirect`にあります。
- **middlewareからServer ActionのPOSTをリダイレクトしてはいけません。** リダイレクトするとPOSTが転送先へ再送され、誘導先との間で往復し続けます（実際にログイン直後の無限ループを起こしました）。ログイン済みユーザーの誘導は画面遷移（GET）でのみ行い、未ログイン時のガードと`/admin/*`の認可はメソッドを問わず適用します。
- ロールは `ADMIN` / `OPERATOR` / `VIEWER` の3種類（[`src/shared/constants/roles.ts`](src/shared/constants/roles.ts)）。`VIEWER`は閲覧のみ、`/admin/*`は`ADMIN`限定です。

## ファイルストレージ

`STORAGE_TYPE`で保存先を切り替えます（[`src/shared/storage/`](src/shared/storage/)）。

| 値 | 保存先 | 用途 |
|---|---|---|
| `local`（既定） | `STORAGE_LOCAL_DIR`（既定`./uploads`） | ローカル開発・検証 |
| `supabase` | Supabase Storage（`SUPABASE_STORAGE_BUCKET`） | 本番 |

呼び出し側は`storage`クライアント経由で操作するため、切り替えによるアプリケーションコードの変更は不要です。

### ブラウザへファイルを渡すURL（`getSignedUrl`）

本番のSupabaseバケットは非公開（private）で運用するため、公開URLではファイルを取得できません（HTTP 400で拒否されます）。ブラウザから直接ファイルを開かせたい場合は`getSignedUrl`を使ってください。

```ts
import { storage } from "@/shared/storage";

const url = await storage.getSignedUrl("contracts/2026/a.pdf"); // 既定60秒で失効
const longer = await storage.getSignedUrl("contracts/2026/a.pdf", 300); // 秒数を指定
```

| 保存先 | 返すURL | 有効期限 |
|---|---|---|
| `supabase` | Supabaseが発行する署名URL（`?token=...`付き） | 既定60秒（第2引数で変更可） |
| `local` | `/uploads/<path>` | なし（署名の概念がないため引数は無視されます） |

> **有効期限は短く保ってください。** 署名URLは「URLを知っていれば誰でも開ける」ため、画面を表示するたびに発行し直す前提で数十秒〜数分に収めます。長くすると、リンクが共有されたりログに残ったりした場合の露出時間がそのまま延びます。

## よく使うコマンド

```text
pnpm dev            # 開発サーバ（ホストで直接動かす場合。事前に db を起動）
pnpm build          # 本番ビルド
pnpm start          # ビルド済みアプリの起動
pnpm worker         # pg-boss ワーカー
pnpm lint           # ESLint
pnpm format         # Prettier で整形
pnpm format:check   # Prettier チェック
pnpm typecheck      # tsc --noEmit
pnpm test           # Vitest
pnpm test:watch     # Vitest（監視モード）
pnpm prisma:generate # Prisma Client 生成
pnpm prisma:migrate # マイグレーション作成・適用（開発）
pnpm prisma:seed    # 初期データ投入
pnpm db:reset       # DB を初期状態に戻して再構築
```

Docker で起動している場合は、`docker compose -f docker/docker-compose.yml exec app <コマンド>` の形で実行します。

- **lint（リント）**: ソースコードを静的に調べ、書き方の問題や不具合につながりやすい箇所を検出します。
- **フォーマット**: インデントや改行など、ソースコードの見た目を統一します。
- **型チェック**: TypeScriptの型定義と実際の値の使い方に矛盾がないか検査します。
- **単体テスト**: 関数やクラスなどの小さな単位が、想定どおりに動作するか自動確認します。
- **本番ビルド**: 開発用のソースコードを、本番環境で実行できる形式へ変換・最適化します。

## 変更をGitに反映する（開発フロー）

`main`ブランチへ直接コミットせず、**作業用ブランチを作る → Pull Requestを出す → CIの成功を確認する → マージする**という流れで進めます。

> **Pull Request（プルリクエスト、PR）**とは、「このブランチの変更を`main`へ取り込みたい」という提案です。提案の段階でCIが自動実行されるため、問題のある変更が`main`へ入る前に気づけます。

```text
main から作業用ブランチを作る
        ↓
変更してコミット
        ↓
ブランチを push        ← この時点ではまだCIは動きません
        ↓
Pull Request を作成    ← ここでCIが動きます
        ↓
CI がグリーンになるのを待つ
        ↓
マージする
        ↓
不要になったブランチを削除する（リモート・ローカルの両方）
```

以下、**コマンドで実行する場合**と**GitHubのサイト上で手作業する場合**の両方を記載します。どちらでも結果は同じです。

### コマンドで実行する場合

GitHub CLI（`gh`）を使います。ブラウザを開かずに完結します。

```powershell
# 1. 変更したファイルを一覧で確認する（ここでステージする対象を決めます）
git status --short

# 2. 作業用ブランチを作る（変更前でも変更後でもよい。未コミットの変更は引き継がれます）
git checkout -b docs/update-readme

# 3. 手順1で確認したファイルをステージする（複数ある場合は空白で区切って並べます）
git add <対象ファイル>

# 4. ステージできたことを確認する（左端に印が付いていればステージ済み）
git status --short

# 5. コミットする（何を・なぜ・どう検証したかを書く。閉じる '@ は行頭に置きます）
git commit -m @'
docs: 変更内容の要約

## 何を
- 変更した内容

## なぜ
- 変更した理由

## どう検証したか
- 実行したコマンドと結果
'@

# 6. リモートへ push する
git push -u origin docs/update-readme

# 7. Pull Request を作成する（ここでCIが動き出します）
gh pr create --base main --title "docs: 変更内容の要約" --body "変更の説明"

# 8. CI の結果を確認する（verify pass と表示されれば成功）
gh pr checks

# 9. マージする。あわせてブランチの後片付けまで行われます
gh pr merge --squash --delete-branch
```

#### `git status --short` の読み方（対象ファイルの決め方）

`git status --short`は、変更のあったファイルを1行ずつ表示します。**各行の先頭2文字**が状態を表し、**左の文字はステージ済みの変更、右の文字はまだステージしていない変更**を意味します。

```text
 M README.md             ← 変更したが、まだステージしていない
?? docs/todo/TODO_新.md  ← 新しく作ったファイル（Gitがまだ追跡していない）
 D docs/old.md           ← 削除したが、まだステージしていない
M  src/proxy.ts          ← ステージ済み（印が左の列へ移動している）
A  docs/new.md           ← 新規ファイルをステージ済み
```

- **`git add`の前**（手順1）は、ここに並んだパスが「今回変更したファイル」です。この中からコミットしたいものを選び、手順3の`<対象ファイル>`へ空白区切りで指定します。
- **`git add`の後**（手順4）は、ステージしたファイルの印が**左の列へ移動します**。左が空白のままの行が残っていれば、そのファイルはステージされていないため、コミットに含まれません。
- ファイルの中身の差分まで確認したい場合は、`git diff`（未ステージ分）と`git diff --staged`（ステージ済み分）を使います。
- 変更したファイルをすべてまとめてステージする`git add -A`もありますが、意図しないファイルを巻き込みやすいため、**使う場合も必ず手順4で内容を確認してください**。

`gh pr merge --delete-branch`は、**リモートブランチの削除・ローカルブランチの削除・`main`への切り替え・`git pull`までをまとめて実行します**。そのため、この方法では後片付けが不要です。

### GitHubのサイト上で手作業する場合

コミットとpush（上記の1〜6）はコマンドで行い、そこから先をブラウザで操作します。

1. push後に表示されるURL、またはリポジトリ画面上部の`Compare & pull request`ボタンからPull Request作成画面を開きます。
2. タイトルと説明を入力し、`Create pull request`を押します。
3. Pull Requestページの下部にあるチェック欄で、CIの結果を確認します。

   | 表示 | 意味 |
   | --- | --- |
   | 🟡 Some checks haven't completed yet | 実行中。待ちます |
   | 🟢 All checks have passed | 成功。マージしてよい状態です |
   | 🔴 Some checks were not successful | 失敗。`Details`リンクからログを確認して修正します |

4. 緑になったら`Merge pull request`→`Confirm merge`を押します。ボタン右側の`▼`から`Squash and merge`を選ぶと、ブランチ上の複数のコミットが1つにまとまって`main`へ入ります。
5. マージ後に表示される**`Delete branch`ボタンを押します**。これでリモートのブランチが削除されます（押すまで残り続けます。誤って消しても`Restore branch`から復元できます）。

**サイト上の操作はリモートしか変更しません。** ローカルには古いブランチと古い`main`が残るため、手作業でマージした場合は次の後片付けが必要です。

```powershell
# 1. main へ戻る（作業中のブランチは削除できないため）
git checkout main

# 2. マージ結果を取り込む
git pull

# 3. 削除済みリモートブランチの参照を掃除する
git fetch --prune

# 4. ローカルブランチを削除する
git branch -d docs/update-readme

# 5. 4 が "not fully merged" で失敗した場合のみ、強制削除する
git branch -D docs/update-readme
```

> **手順5が必要になる理由**: `git branch -d`は「そのブランチの内容が`main`に入っているか」を確認してから削除します。ところがsquashマージは元のコミットをそのまま`main`へ載せず、**新しい1つのコミットを作り直す**ため、Gitからは別物に見えて「まだマージされていない」と判定されます。Pull Requestがマージ済みであることを確認したうえで`-D`を使えば問題ありません。

### ドキュメントだけの変更でCIを実行しない（`main`へ直接push）

[`docs/todo/TODO.md`](docs/todo/TODO.md)や`README.md`のように、**アプリの動作に一切影響しないファイルだけを変更した場合**は、lint・型チェック・ビルドを実行する意味がありません。この場合に限り、**作業用ブランチもPull Requestも作らず**、`main`上で直接コミットしてpushし、CIをスキップできます。

つまり、上で説明した通常のフローを丸ごと省略します。

| | 通常のフロー | この方法 |
|---|---|---|
| 作業用ブランチ | 作る | **作らない**（`main`上で直接コミットする） |
| Pull Request | 作る | **作らない** |
| CI | Pull Request作成時に動く | 動かない |
| ブランチの後片付け | 必要 | **不要**（削除するブランチがないため） |

> `main`にブランチ保護は設定していないため、直接pushは技術的に可能です（[補足](#補足)参照）。**この方法を使ってよいのは下表の「CI不要」に該当する変更だけ**です。迷ったら通常どおりPull Requestを出してください。

| 変更したファイル | 判断 | CIの止め方 |
|---|---|---|
| `README.md` / `README_SIMPLE.md` / `AGENTS.md` / `CLAUDE.md` / `docs/**` / その他すべての `*.md` | CI不要 | **自動でスキップ**（`paths-ignore`） |
| `.claude/**` / `.agents/**` のうち `*.md` 以外（`settings.json` など） | CI不要 | 手動でスキップ（`[skip ci]`） |
| `src/**` / `prisma/**` / `package.json` / `pnpm-lock.yaml` / `*.ts` / `*.json` などの設定ファイル | **CI必須** | 止めない |
| `.github/workflows/ci.yml` | **CI必須** | 止めない（CI自体の変更は、動かさないと検証できないため） |
| `docker/**` | **CI必須** | 止めない |

#### 仕組み1: `paths-ignore` による自動スキップ（設定済み）

[`.github/workflows/ci.yml`](.github/workflows/ci.yml)に、CIを起動しないパスを登録してあります。

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

- `"**.md"`はリポジトリ内のすべての`.md`ファイル（`README.md`・`AGENTS.md`・`docs/`配下など）に、`"docs/**"`は`docs/`配下のすべてのファイルに一致します。
- **判定は「そのpush（またはPull Request）で変更されたファイルが1つ残らず一致した場合にのみスキップ」です。** 1ファイルでもコードが混ざっていれば、通常どおり全ステップが実行されます。安全側に倒れているため、うっかりコードの検証を飛ばしてしまうことはありません。
- `ci.yml`自身はどちらのパターンにも一致しないため、**CIの設定変更は必ずCIで検証されます**。

この仕組みがあるので、ドキュメントだけを変更する場合は**特別なことをせず、そのままコミットしてpushするだけ**でCIは動きません。

```powershell
# 1. 変更したファイルを一覧で確認し、上表の「CI不要」だけであることを確かめる
git status --short

# 2. main へ移動する（新しくブランチを作るのではありません。すでに main にいれば何も起きません）
git checkout main

# 3. リモートの最新を取り込む（先に他の変更が入っていると push が弾かれるため）
git pull

# 4. 変更をステージする（4a・4b のどちらか一方を実行します）

# 4a. ファイルを指定してステージする（例: git add README.md docs/todo/TODO.md）
git add <対象ファイル>

# 4b. 手順1の一覧がすべて「CI不要」だった場合は、変更ファイルを一式まとめてステージする
git add -A

# 5. ステージした内容を目視確認する（左端に印が付いた行だけがコミットされます）
git status --short

# 6. コミットする（[skip ci] は不要。paths-ignore が自動で判定します）
git commit -m "docs: TODOの進捗を更新する"

# 7. main へ直接 push する（Pull Request は作りません）
git push

# 8. CI が実行されていないことを確認する（今回の push に対応する行が増えていなければ成功）
gh run list --limit 3
```

手順1・5の表示の読み方は「[`git status --short`の読み方（対象ファイルの決め方）](#git-status---shortの読み方対象ファイルの決め方)」を参照してください。**この方法ではPull Requestによる見直しの機会がないため、手順1でコード（`src/**`など）が混ざっていないことを必ず確認してください。**

手順4bの`git add -A`（`--all`の短縮形）は、**変更・新規作成・削除のすべてをまとめてステージする**指定です。ドキュメントを何ファイルも直した場合に、1つずつ書き並べる手間を省けます。

| | 対象 | 向いている場面 |
|---|---|---|
| `git add <対象ファイル>` | 指定したファイルだけ | 変更の一部だけをコミットしたいとき |
| `git add -A` | リポジトリ内の変更ファイル一式 | 手順1の一覧が全部コミット対象のとき |

- **カレントディレクトリではなくリポジトリ全体が対象**のため、どのディレクトリで実行しても結果は同じです。
- [`.gitignore`](.gitignore)に登録されたファイル（`.env`・`node_modules/`・`.next/`など）は含まれません。ただし、**過去に一度コミットしてしまったファイルは`.gitignore`に書いても対象に残る**点に注意してください。
- **手順1の一覧にコードが1つでも混ざっていれば、それも一緒にステージされます。** `git add -A`を使うのは、手順1で「CI不要」のファイルだけだと確認できた場合に限ってください。判断に迷う場合は4aでファイル名を明示します。

手順8の`gh run list`は、CIの実行履歴を新しい順に表示するコマンドです。スキップに成功していれば、**今回のコミットに対応する行は現れません**（成功でも失敗でもなく、そもそも実行されないためです）。ブラウザで確認する場合は、リポジトリの`Actions`タブと、コミット一覧に🟢や🔴のマークが付いていないことを見ます。

#### 仕組み2: `[skip ci]`（`paths-ignore`で拾えないファイル向け）

`.claude/settings.json`のように、`**.md`にも`docs/**`にも当てはまらないけれどCIでの検証が不要なファイルもあります。この場合は、コミットメッセージに決められた文字列を含めることで、そのpushで起動するはずのワークフローを個別に止められます。

```powershell
git commit -m "chore: エージェントの権限設定を追加する [skip ci]"
```

使える文字列は次の5つです。どれを使っても効果は同じで、**角かっこも含めて**記述します。複数行のコミットメッセージにする場合も、1行目（件名）の末尾に付けると確認しやすくなります。

```text
[skip ci]  [ci skip]  [no ci]  [skip actions]  [actions skip]
```

- **こちらは人が判断する方式です。** `paths-ignore`と違い、コードを含む変更に付けてしまうと検証が丸ごと飛びます。基本は`paths-ignore`に任せ、これは例外的に使ってください。
- **pushに含まれるコミットのうち1つでもこの文字列を含んでいれば、そのpush全体のCIがスキップされます。** コードの変更を含むコミットを同じpushに混ぜないでください。
- Pull Requestの場合は、**HEAD（最新）コミットのメッセージだけ**が判定対象です。

#### 共通の注意点

- **スキップされた場合、Actionsタブに実行履歴そのものが残りません。** 「失敗」ではなく「最初から実行されない」状態になり、コミット一覧にもチェックマークが付きません。
- **作業用ブランチを経由しないため、誤った内容もそのまま`main`に載ります。** Pull Requestのように、マージ前に内容を見直す機会がありません。取り消すには`git revert`が必要になるので、手順1と手順5の`git status --short`で内容を必ず確認してください。
- すでに作業用ブランチを作ってしまった場合でも、コミット前であれば手順2の`git checkout main`で変更がそのまま`main`側へ引き継がれるため、手順4から続けられます。
- **`paths-ignore`が効くのはGitHub Actionsだけです。** 本番デプロイを担うCloud Buildは別の仕組みのため、ドキュメントだけの変更でもデプロイが走ります。止めたい場合はCloud Build側のトリガー設定（「含まれるファイルと無視されるファイルのフィルタ」）で除外するか、コミットメッセージに`[skip ci]` / `[ci skip]`を付けます（Cloud Buildも同じ文字列に対応しています）。**2026-08-04にCloud Runを構築したため、`main`への push は本番デプロイを引き起こします。**
- 将来`main`にブランチ保護を設定し`verify`を必須チェックにした場合、**ドキュメントだけのPull Requestは「チェックが未実行」のままマージできなくなります**（`paths-ignore`・`[skip ci]`のどちらでも同じです）。その時点で、ドキュメント変更は`main`へ直接pushする運用にするか、必須チェックの扱いを見直す必要があります。

### 補足

- **作業用ブランチへpushしただけではCIは動きません。** [`.github/workflows/ci.yml`](.github/workflows/ci.yml)は`main`へのpushとPull Requestのみを対象にしているためです。CIはPull Requestを作成した時点で初めて実行されます（ただし変更が`*.md`と`docs/`だけの場合は、`paths-ignore`により実行されません）。
- **`main`にブランチ保護は設定していません。** privateリポジトリでこの機能を使うにはGitHub Proまたはpublic化が必要なためです。したがって**CIが赤くてもマージボタンは押せてしまいます**。上記の流れは仕組みによる強制ではなく、運用ルールとして守るものです（[`docs/todo/TODO.md`](docs/todo/TODO.md)の「残っているタスク」参照）。
- 日本語の複数行コミットメッセージをPowerShellから渡すときは、上記のヒアストリング（`@'` 〜 `'@`）を使います。**閉じる`'@`は行頭**に置いてください。インデントすると構文エラーになります。

## CI（GitHub Actions）

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) が、`main`への push と Pull Request で単一の`verify`ジョブを実行します。ただし変更が`**.md`と`docs/**`だけの場合は`paths-ignore`により起動しません。

1. `pnpm lint`（ESLint）
2. `pnpm format:check`（Prettier）
3. `prisma validate`（スキーマ検証）
4. `prisma generate`（Prisma Client 生成）
5. `pnpm typecheck`（tsc）
6. `prisma migrate deploy`（**0からスキーマを再現できることの検証**）
7. `pnpm test`（Vitest）
8. `pnpm build`（本番ビルド）

PostgreSQL 16 をサービスコンテナとして起動し、実際にマイグレーションを適用して検証します。デプロイ自体は Cloud Build に任せるため、GitHub Actions からは行いません。

ドキュメントだけを変更した場合など、この検証が不要なときの進め方は「[ドキュメントだけの変更でCIを実行しない（`main`へ直接push）](#ドキュメントだけの変更でciを実行しないmainへ直接push)」を参照してください。

> **`prisma generate` が `typecheck` より前にある理由**: Prisma Client（`@prisma/client` の型）は`prisma/schema.prisma`から生成されるコードであり、`node_modules`配下に作られるため Git では管理していません。生成前に`tsc`を走らせると`Module '"@prisma/client"' has no exported member 'Party'`のように型が見つからず失敗します。ローカルで同じエラーが出たときも`pnpm prisma:generate`で解決します。

## 本番デプロイ（Google Cloud Run + Supabase）

> **本番環境をゼロから構築する場合は [`docs/specs/99_infra/READ_ME_INFRA.md`](docs/specs/99_infra/READ_ME_INFRA.md)（インフラ構築手順書）を参照してください。** アカウント作成から動作確認まで、画面操作と用語の説明を含めて手順化してあります。以下はその要約です。

- **本番DB / ストレージ**: [Supabase](https://supabase.com/) の PostgreSQL + Storage を使用。`STORAGE_TYPE=supabase`に切り替える。接続文字列は **Session pooler** のものを使う（Direct connection は IPv6 専用で Cloud Run から到達できず、Transaction pooler は `prisma migrate deploy` が通らない）。
- **ホスティング**: [Google Cloud Run](https://cloud.google.com/run) に GitHub リポジトリを連携し、`main` ブランチへの push を契機に Cloud Build が [`docker/Dockerfile`](docker/Dockerfile) をビルドして自動デプロイする。リージョンは Always Free 対象の **us-central1**、最小インスタンス数は **0**、**最大インスタンス数は 2**（既定の 100 のままだと想定外のアクセスで無料枠を超えるため必ず絞る）。メモリは既定の **512MiB** で足りる（実測 77MB）。
- **サービス構成**: [`docker/Dockerfile`](docker/Dockerfile) の`runner`ステージは app / worker 共用だが、**本番で立てるのは Web（既定の`CMD` = `./node_modules/.bin/next start`）のみ**。ワーカーは [`src/worker/index.ts`](src/worker/index.ts) が待受のみで登録済みジョブを持たないため起動しない。実ジョブを追加する段階で Cloud Run Jobs か常駐サービスかを判断する。
- **本番イメージには開発用の依存が入っていません**。`runner`ステージは devDependencies（TypeScript・ESLint・Vitest 等）と、glibc ベースでは使われない musl 版ネイティブバイナリを除いてビルドします。**pnpm の実体も入っていない**ため、コンテナ内でワーカーを起動する場合は`pnpm worker`ではなく`./node_modules/.bin/tsx src/worker/index.ts`を使ってください（`pnpm`を叩くと corepack がレジストリへ取得しに行きます）。
- **ビルド設定**: リポジトリ直下に `Dockerfile` が無いため、ビルド構成で **`docker/Dockerfile`** を明示する。加えて **ビルドコンテキストをリポジトリルート（`.`）にする**こと。Cloud Build の Dockerfile モードは「Dockerfile のあるディレクトリ＝コンテキスト」として扱うため、既定のままだと `COPY package.json` が `file does not exist` で失敗する。
- **環境変数**: `.env.example` を参考に、本番用の値（Supabase の接続文字列・`AUTH_SECRET`・`LOG_PRETTY=false` 等）を Cloud Run のサービス設定へ登録する。`AUTH_TRUST_HOST=true` はリバースプロキシ背後のため必須。`AUTH_URL` は **サービス作成画面に表示されるエンドポイント URL** をそのまま設定できる（サービス名とリージョンを入力した時点で確定するため、デプロイ後に設定し直す必要はない）。
- **マイグレーション**: Cloud Run にはデプロイ前フックがないため、**ローカルから本番 DB に対して `prisma migrate deploy` を手動実行**する。
- **初期データ**: `prisma migrate deploy` は seed を実行しないため、初回のみローカルから `pnpm prisma:seed` を本番 DB に対して実行する（`SEED_ADMIN_PASSWORD` を必ず指定する）。

> ポートは Cloud Run が `PORT=8080` を注入し `next start` がそれを読むため、設定は不要です（`docker/Dockerfile` の `EXPOSE 3000` は Cloud Run では参照されません）。進捗と残タスクは [`docs/todo/TODO.md`](docs/todo/TODO.md)、コマンド単位の手順（接続文字列の選び方・`migrate deploy` / seed の実行・本番の環境変数一覧）は [`docs/todo/TODO_補足.md`](docs/todo/TODO_補足.md) を参照してください。

技術選定の背景・段階的な拡張方針は [`docs/foundation_plan.md`](docs/foundation_plan.md) を参照。

## AIエージェントによる開発（マルチAIエージェント構成）

本プロジェクトは、**GitHub Copilot / Claude Code / Codex のいずれのAIコーディングエージェントでも開発できる**ように構成しています。特定のツールに依存しないため、開発者ごとに使い慣れたエージェントを選べます。

> **AIコーディングエージェント**とは、リポジトリの内容を読み取り、指示に応じてコードの追加・修正やコマンド実行を行うツールです。各ツールは、それぞれ決められた名前の指示ファイルを起動時に自動で読み込みます。

### 指示ファイルの構成

各エージェントは読み込むファイル名が異なりますが、**内容の正本は [`AGENTS.md`](AGENTS.md) の1つだけ**です。ツールごとのファイルは `AGENTS.md` を参照する薄い入口として置き、方針が二重管理にならないようにしています。

| エージェント | 自動で読み込むファイル | 役割 |
|---|---|---|
| 共通（正本） | [`AGENTS.md`](AGENTS.md) | 開発方針・規約の**正本**。全エージェントがこれに従う |
| Codex | [`AGENTS.md`](AGENTS.md) | 正本をそのまま読み込む（Codex の標準ファイル名） |
| Claude Code | [`CLAUDE.md`](CLAUDE.md) | `AGENTS.md` を取り込み、Claude Code 固有の補足を追記 |
| GitHub Copilot | [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | `AGENTS.md` を参照し、Copilot 固有の補足を追記 |

加えて、作業対象のディレクトリに応じて近接の [`src/AGENTS.md`](src/AGENTS.md)（アーキテクチャ規約）・[`prisma/AGENTS.md`](prisma/AGENTS.md)（DB 規約）も参照されます。

作業の種類ごとの規約は、正本から次のファイルへ委譲しています。

| 作業 | 参照するファイル |
|---|---|
| UI / デザイン | [`DESIGN.md`](DESIGN.md) |
| コミット / PR レビュー | [`REVIEW.md`](REVIEW.md) |
| テスト作成 | [`TESTING.md`](TESTING.md) |

### スキル（定型作業の手順）

繰り返し行う作業は「スキル」として手順化しており、**手順の正本も [`docs/skills/`](docs/skills/) の1ファイルだけ**です。各ツールの入口ファイルは、その正本を読ませるだけの薄いラッパーです。

| スキル | 内容 | 正本 |
|---|---|---|
| `update-todo` | [`docs/todo/TODO.md`](docs/todo/TODO.md) を更新し、影響があれば `README.md` / `README_SIMPLE.md` も更新する | [`docs/skills/update-todo.md`](docs/skills/update-todo.md) |
| `push-skip-ci` | CIを起動させずに変更をpushする。ドキュメントに限らずソースコードでも使えるが、**実行前に必ず確認を求める** | [`docs/skills/push-skip-ci.md`](docs/skills/push-skip-ci.md) |

| エージェント | 入口ファイル | 起動方法 |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | `/update-todo` のように入力、または内容に応じて自動起動 |
| GitHub Copilot | `.github/prompts/<name>.prompt.md` | Copilot Chat で `/update-todo` のように入力 |
| Codex | `.agents/skills/<name>/SKILL.md` | 内容に応じて自動起動 |

スラッシュコマンドを使わず「TODO を更新して」「CIスキップでプッシュして」と伝えるだけでも、[`AGENTS.md`](AGENTS.md) からの参照を通じて同じ手順が適用されます。

### 方針を追加・変更するとき

- **全エージェントに共通する内容**は、`AGENTS.md`（またはサブディレクトリの `AGENTS.md`）へ書きます。
- **定型作業の手順**は、`docs/skills/<name>.md`（正本）へ書きます。入口ファイルへ手順を複製しないでください。
- **特定のエージェントにだけ必要な補足**は、そのツールのファイルの「◯◯ 固有」セクションへ書きます。
- どのエージェントを使っても、成果物は同じ規約・同じ CI（`pnpm lint` / `format:check` / `typecheck` / `test` / `build`）で検証されます。

## ドキュメント

| 文書 | 内容 |
|---|---|
| [`README_SIMPLE.md`](README_SIMPLE.md) | ローカル環境構築の最小手順（初めての方向け） |
| [`AGENTS.md`](AGENTS.md) | 開発方針の正本（全エージェント共通 / Codex が読み込む） |
| [`CLAUDE.md`](CLAUDE.md) | Claude Code 向けの入口（`AGENTS.md` + Claude 固有の補足） |
| [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | GitHub Copilot 向けの入口（`AGENTS.md` + Copilot 固有の補足） |
| [`docs/foundation_plan.md`](docs/foundation_plan.md) | 設計・確定方針（設計の正本） |
| [`docs/specs/99_infra/READ_ME_INFRA.md`](docs/specs/99_infra/READ_ME_INFRA.md) | **インフラ構築手順書**（本番環境をゼロから構築する手順の正本） |
| [`docs/diagrams.md`](docs/diagrams.md) | 構成図・フロー図 |
| [`docs/prisma_operations.md`](docs/prisma_operations.md) | Prisma マイグレーション運用フロー |
| [`docs/todo/TODO.md`](docs/todo/TODO.md) | 残タスク一覧・進捗・現在の状態 |
| [`docs/todo/TODO_補足.md`](docs/todo/TODO_補足.md) | 残タスクの補足（Supabase / Cloud Run の設定値・手順・落とし穴） |
| [`docs/todo/TODO_履歴.md`](docs/todo/TODO_履歴.md) | セッションごとの作業記録（引き継ぎメモ） |
| [`docs/skills/update-todo.md`](docs/skills/update-todo.md) | TODO / README の更新手順（スキルの正本・全エージェント共通） |
| [`docs/skills/push-skip-ci.md`](docs/skills/push-skip-ci.md) | CI をスキップして push する手順（スキルの正本・全エージェント共通） |
| [`src/AGENTS.md`](src/AGENTS.md) | アーキテクチャ規約（feature-modular） |
| [`prisma/AGENTS.md`](prisma/AGENTS.md) | DB 規約 |
| [`DESIGN.md`](DESIGN.md) | UI / デザイン規約（shadcn/ui + Tailwind v4） |
| [`REVIEW.md`](REVIEW.md) | コミット / PR レビュー観点 |
| [`TESTING.md`](TESTING.md) | テスト方針（単体） |