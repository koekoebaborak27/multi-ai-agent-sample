import { PrismaClient } from "@prisma/client";
import { logger } from "@/shared/observability/logger";

/**
 * データベースへの接続をアプリ全体で1つだけ持つようにする。
 *
 * 開発中はコードを保存するたびにファイルが読み込み直されるため、
 * そのつど接続を作ると接続が増え続けて上限に達してしまう。
 * それを防ぐため、作った接続をアプリ全体で使い回せる場所に覚えさせている。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// データベースへの接続を作る。
// データベース側で起きたエラーや警告も、アプリの記録として一緒に残るようにしている。
function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: [
      { emit: "event", level: "error" },
      { emit: "event", level: "warn" },
    ],
  });
  client.$on("error", (e) => logger.error({ err: e }, "prisma.error"));
  client.$on("warn", (e) => logger.warn({ event: e }, "prisma.warn"));
  return client;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

// 本番はファイルの読み込み直しが起きないため、覚えさせるのは開発中だけでよい
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
