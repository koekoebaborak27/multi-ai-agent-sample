# Prisma CLI（エージェント実行時の注意）

`prisma migrate dev` はエージェントの非対話シェルからは実行できない。ここでは代わりの手順を記録する。

- [`prisma migrate dev` がエージェントの非対話シェルで使えない](#prisma-migrate-dev-がエージェントの非対話シェルで使えない)
- [`pnpm prisma:migrate -- --name ...` の書き方が引数を渡しきれずハングすることがある](#pnpm-prismamigrate----name--の書き方が引数を渡しきれずハングすることがある)

## `prisma migrate dev` がエージェントの非対話シェルで使えない

**2026-08-19（マスタ分類の見直し）・2026-08-21（パスワード再発行機能）の両方で発生。** `prisma migrate dev`（`pnpm prisma:migrate`）は、確認プロンプトが発生しうる変更（ユニーク制約の追加時の重複警告など）はもちろん、警告が一切ない変更や `--create-only` でも、非対話シェル（Claude Code の Bash / PowerShell ツール）からは次のエラーで止まる。

```text
Error: Prisma Migrate has detected that the environment is non-interactive, which is not supported.
```

`CI=true` などの環境変数でも回避できない。**Prisma CLI が起動時に `stdin` の TTY 有無を無条件でチェックしているため**で、`--create-only` を付けても同じ判定にかかる。

**代わりに `prisma migrate diff` で SQL を自動生成し、手作業でマイグレーションフォルダを作ってから `prisma migrate deploy`（非対話コマンド）で適用する。** `schema.prisma 編集 → 自動生成` の原則（`prisma/AGENTS.md`）は保てる。手で SQL を書くわけではなく、diff コマンドが生成した SQL をそのまま使うだけ。

```powershell
# 0) ローカル DB が起動していること（docker compose -f docker/docker-compose.yml up -d db）
# 1) schema.prisma を編集する

# 2) 現在の DB 状態と schema.prisma の差分 SQL を生成して確認する
$env:DATABASE_URL = 'postgresql://app:password@localhost:5432/app_db'
pnpm exec prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script

# 3) マイグレーションフォルダを作り、2) の出力をそのまま migration.sql として保存する
#    フォルダ名は既存の命名規約と同じ「YYYYMMDDHHMMSS_snake_case名」（UTC）
#    例: prisma/migrations/20260821023637_add_password_reset/migration.sql

# 4) 非対話コマンドの migrate deploy で適用する（migrate dev と違い TTY チェックが無い）
pnpm exec prisma migrate deploy

# 5) クライアントを再生成し、差分が残っていないか確認する（出力が空なら drift 無し）
pnpm exec prisma generate
pnpm exec prisma migrate diff --from-url $env:DATABASE_URL --to-schema-datamodel prisma/schema.prisma --script
```

- `--from-migrations prisma/migrations`（適用済みマイグレーションの積み上げから比較する方式）は shadow database が要るため使わない。`--from-url`（実際の DB を直接見る方式）ならローカル DB 1 つだけで完結する
- **ユニーク制約の追加など、実データに依存する変更は `prisma migrate diff` も警告なしで SQL を出す。** 事前に重複がないか手動で確認すること（[`01_データベース.md`](../../specs/02_basic-design/password-reset/01_データベース.md#016-マイグレーションの手順) のような設計書に手順がある場合はそれに従う）
- 2026-08-19 の別の回避策（列削除やデータ移行を伴う変更を、まず警告の出ない形で雛形生成してから手書きで追記する方法）は、`--create-only` 自体が使えないと判明した今は不要。今後はこの `migrate diff` 方式に統一してよい
- **補足（2026-08-24）**: 非対話シェルで実際に止まるのは「確認プロンプトが必要になる場面」（テーブルが空でない状態での削除・リネーム等の警告）だけだった。警告が出ない変更であれば `pnpm exec prisma migrate dev --create-only --name <name>` がそのまま通ることを確認した（お知らせ管理機能のテーブルリネーム作業で、ローカルDBの対象テーブルを空にしてから実行し成功）。`migrate diff` 方式が最も安定するが、警告が出ないと分かっている単純な追加だけなら `--create-only` でも代替できる

## `pnpm prisma:migrate -- --name ...` の書き方が引数を渡しきれずハングすることがある

**2026-08-24（お知らせ管理機能のDBスキーマ変更）で発生。** `docs/prisma_operations.md` が例示している `pnpm prisma:migrate -- --create-only --name <name>`（`package.json` の `prisma:migrate` スクリプト経由）を実行すると、ログ上は `prisma migrate dev "--" "--create-only" "--name" "<name>"` のように **`--` がそのまま prisma CLI への引数として渡ってしまい**、`--name` が正しく認識されず「Enter a name for the new migration」の対話プロンプトで待ち状態のままハングした。標準入力へ `y` 等を流し込んでも解消しない。

放置すると、この待機プロセス（`node.exe`の子プロセス）が PostgreSQL のアドバイザリロック（`pg_advisory_lock`）を握ったまま残り、以降の `prisma migrate` 系コマンドが `P1002 The database server was reached but timed out` で失敗するようになる。

**対処**:

1. `pnpm exec prisma migrate dev --create-only --name <name>`（`pnpm run` のラッパーを経由せず直接呼ぶ）に書き換えると、引数が正しく渡り即座に完了する
2. 既にハングしている場合は、そのプロセス（Windowsなら `Get-Process -Name node` で直近開始のものを特定）を終了させてからやり直す。ロックを握ったプロセスを終了しない限り、以降のコマンドはすべてタイムアウトする
