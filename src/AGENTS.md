# src/ — アーキテクチャ規約

正本は `@AGENTS.md`。ここは `src/` 配下の構造ルールのみ。

## フィーチャーモジュラー（DDD-lite）

- 機能（境界づけられたコンテキスト）ごとに `src/modules/<機能>/` に**縦割り**で完結させる。1機能=1フォルダ=レビュー単位。
- **依存方向は一方向**: `app/ → modules/ → shared/`（逆流・横流れ禁止）。
- `modules/A` は `modules/B` の内部を直接 import しない。**`modules/B/index.ts` の公開 API のみ**使う。
- `app/` は**薄いアダプタ**。fetch して module を呼び描画するだけ。ロジックを持たせない。
- 認証ガード / RBAC は `src/proxy.ts`（Next.js 16。JWT クレームで判定、DB アクセスしない）。

## モジュール標準ファイル

`ui/*.tsx` / `actions.ts`（Server Actions）/ `service.ts`（ユースケース）/ `repository.ts`（Prisma I/O）/ `validation.ts`（Zod）/ `types.ts` / `index.ts`（公開API）。

- CRUD 機能は上記でフラットに。**複雑な機能のみ** `domain/ application/ infrastructure/ jobs/` に層化する（過剰設計を避ける）。

## 厳守事項

- **Prisma は `repository.ts` と `shared/db` 以外から触らない**。
- DB・シークレット等サーバ専用コードは `server-only` を import（クライアント混入防止）。※ worker から読まれる `shared/observability`・`shared/jobs`・`shared/config`・`shared/db` には付けない。
- **観測性（ログ）**: 入口は `shared/observability` の `withOp`（Server Action）/ `withRoute`（API）/ `withJob`（pg-boss）でラップする。業務コードに `try/catch` やログは**書かない**。エラーは `throw new AppError(code, httpStatus, userMessage, context)` するだけ（ログは境界が1回だけ出す）。生成は `shared/errors/app-error.ts` の `Errors` ファクトリを使う。`code` は grep 可能なキー文字列で、標準コードは `Errors.*`（`NOT_FOUND` / `UNAUTHORIZED` / `FORBIDDEN` / `VALIDATION_ERROR` / `CONFLICT`）、それ以外は独自キーを足してよい。
- 一覧 UI（サーバ駆動のソート/ページング + 素の `<Table>`、TanStack Table 不採用）の規約は `DESIGN.md`「一覧（テーブル）」を正本とする。
- **テスト**は対象ファイル隣にコロケーション（`<name>.test.ts`、`__tests__/` は原則作らない）。レイヤー選別・観点・分割方針の詳細は `TESTING.md`。
