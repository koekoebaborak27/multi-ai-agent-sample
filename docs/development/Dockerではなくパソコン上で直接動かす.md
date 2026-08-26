# Dockerではなくパソコン上で直接動かす

[`プロジェクトの導入手順.md`](プロジェクトの導入手順.md)では、アプリ・ジョブワーカー・データベースの3つをすべてDockerで起動する方法を案内しています。このファイルは、**データベースだけDockerで起動し、Next.jsの開発サーバはパソコン上で直接動かしたい場合**の手順です。

この方法では、Next.jsの開発サーバをパソコン上で起動し、パソコン上のソースコードと`node_modules`をそのまま使います。そのため、アプリ用コンテナの起動や、コンテナ内へのパッケージのインストールを待たずに開発を始められます。

ソースコードを保存したときの画面への自動反映は、Docker一式で起動する方法でも利用できます。この方法だけの利点ではありません。違いは、アプリの実行とパッケージの管理をDocker内ではなくパソコン上で行う点です。

## 手順

### 1. PostgreSQLを起動する

```powershell
docker compose -f docker/docker-compose.yml up -d db
```

### 2. マイグレーションを適用する

```powershell
pnpm prisma:migrate
```

### 3. 初期データを投入する（初回のみ）

```powershell
pnpm prisma:seed
```

### 4. 開発サーバを起動する

終了するときは、`Ctrl+C`を押します。

```powershell
pnpm dev
```

### 5. ジョブワーカーを起動する（必要な場合のみ）

開発サーバを動かしているターミナルとは別のターミナルで実行します。

```powershell
pnpm worker
```

この方法では`.env`の値がそのまま使われるため、`AUTH_SECRET`を必ず設定してください（後述）。`DATABASE_URL`は`.env.example`の値（`localhost:5432`）のままで接続できます。

## `AUTH_SECRET`を設定する

`AUTH_SECRET`とは、ログイン情報が途中で書き換えられていないかを確認するために使う、パソコンだけが知っている秘密の合言葉のようなものです。他人に推測されないよう、ランダムな文字列に変更してください。

`.env`ファイルをテキストエディタで開き、`AUTH_SECRET=`の右側を、次のコマンドで作った文字列に書き換えます。

```powershell
# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

```bash
# macOSまたはLinux
openssl rand -base64 32
```
