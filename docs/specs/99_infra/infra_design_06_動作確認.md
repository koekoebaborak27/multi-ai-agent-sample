# 10. 手順5 動作を確認する

手順5。疎通確認・ログイン確認・自動デプロイの確認。

インフラ構築手順書の一部。全体の目次と進め方は [`README.md`](README.md) を見ること。


所要時間の目安: 30 分。

## 10.1 URL を確認する

Cloud Run のサービス詳細画面に、エンドポイント URL が表示されます。

```powershell
$base="https://<サービス名>-<プロジェクト番号>.us-central1.run.app"
```

## 10.2 疎通を確認する

ブラウザを開かずに、コマンドで確認できます。

```powershell
Invoke-WebRequest "$base/api/health" -UseBasicParsing            # {"data":{"status":"ok"}}
Invoke-WebRequest "$base/api/health?check=db" -UseBasicParsing   # {"data":{"status":"ok","db":"up"}}
Invoke-WebRequest "$base/login" -UseBasicParsing                 # 200
```

| 確認内容                   | 期待する結果       | 失敗した場合                                |
| ---------------------- | ------------ | ------------------------------------- |
| `/api/health`          | `status: ok` | アプリが起動していません → [13 章](infra_design_09_トラブルシュート.md#13-トラブルシュート)   |
| `/api/health?check=db` | `db: up`     | データベースへ接続できていません → `DATABASE_URL` を確認 |
| `/login`               | 200          | ログイン画面の配信に問題があります                     |

> 初回アクセスはコールドスタートのため、応答まで数秒〜十数秒かかります。

## 10.3 システムの動作確認をする

ブラウザで `$base` を開き、[8.5](infra_design_04_本番データベース初期化.md#85-初期管理者を登録する) で登録した管理者でログインして動作確認をします。

1. ログインする。
2. **画面からデータを登録し、一覧に表示されることを確認する**（データベースへの書き込みと読み出しの確認）

## 10.4 自動デプロイを確認する

`main` へ変更を反映したときに、本番へ自動デプロイされることを確認します。

デプロイが反映されたかどうかは、**画面が読み込む JavaScript ファイルの名前の変化**で判定します。

```powershell
$l=(Invoke-WebRequest "$base/login" -UseBasicParsing).Content
([regex]::Matches($l,'/_next/static/chunks/[a-z0-9_\-]+\.js') | ForEach-Object { $_.Value }) | Select-Object -Unique
```

デプロイの前後でこのファイル名が変われば、新しいリビジョンへ切り替わっています。

> **CSS ファイルの名前では判定できません。** このテンプレートが使う Tailwind CSS は、実際に使われている見た目の指定だけを集めて CSS を生成するため、指定が増えない変更ではファイル名が変わりません。
