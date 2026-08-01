import { PrismaClient } from "@prisma/client";
import { logger } from "@/shared/observability/logger";

/**
 * Prisma シングルトン。開発時の HMR による接続増殖を防ぐ。
 * error/warn を Pino へ接続する（§9: DB層のエラー/警告を自動集約）。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

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

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
