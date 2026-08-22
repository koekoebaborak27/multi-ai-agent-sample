# Prisma CLI（エージェント実行時の注意）

`prisma migrate dev` はエージェントの非対話シェルからは実行できない。ここでは代わりの手順を記録する。

- [`prisma migrate dev` がエージェントの非対話シェルで使えない](#prisma-migrate-dev-がエージェントの非対話シェルで使えない)

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
