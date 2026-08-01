import { defineConfig } from "prisma/config";

// Prisma CLI の設定ファイル（正本）。
// 旧来の `package.json#prisma` は非推奨で Prisma 7 では削除されるため、こちらへ移行済み。
//
// 重要: この設定ファイルが存在すると Prisma CLI は .env を自動読み込みしなくなる
// （"Prisma config detected, skipping environment variable loading."）。
// そのため DATABASE_URL などを Node 標準の loadEnvFile で明示的に読み込む。
// 既に設定済みの環境変数が優先されるため、本番（Cloud Run 等）の実 env を上書きしない。
try {
  process.loadEnvFile();
} catch {
  // .env が無い環境（CI / 本番コンテナ）では実 env のみを使う
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // `prisma db seed` および `prisma migrate reset`（= pnpm db:reset）から実行される
    seed: "tsx prisma/seed.ts",
  },
});
