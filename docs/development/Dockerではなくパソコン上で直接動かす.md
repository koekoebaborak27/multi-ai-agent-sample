# Dockerではなくパソコン上で直接動かす

[`プロジェクトの導入手順.md`](プロジェクトの導入手順.md)では、アプリ・ジョブワーカー・データベースの3つをすべてDockerで起動する方法を案内しています。このファイルは、**データベースだけDockerで起動し、Next.jsの開発サーバはパソコン上で直接動かしたい場合**の手順です。

ソースコードを直す人が、修正内容をすぐ画面へ反映させたい場合などに向いています（Docker一式で起動する場合と違い、コンテナの`node_modules`を後から揃え直す手間がありません）。

## 手順

```powershell
docker compose -f docker/docker-compose.yml up -d db   # PostgreSQL のみ起動
pnpm prisma:migrate                                    # マイグレーション適用
pnpm prisma:seed                                       # 初期データ投入（初回のみ）
pnpm dev                                               # 開発サーバ（Ctrl+C で停止）
pnpm worker                                            # ジョブワーカー（必要な場合のみ・別ターミナル）
```

この方法では`.env`の値がそのまま使われるため、`AUTH_SECRET`を必ず設定してください。`DATABASE_URL`は`.env.example`の値（`localhost:5432`）のままで接続できます。

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
