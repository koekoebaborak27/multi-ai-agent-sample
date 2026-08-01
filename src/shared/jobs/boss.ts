import { PgBoss } from "pg-boss";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/observability/logger";

/**
 * pg-boss インスタンス（シングルトン）。
 * スキーマ/テーブルは pg-boss が起動時に自動作成する（マイグレーション管理しない）。
 * app 側は送信(send)、worker 側は購読(work) に使う。
 */
const globalForBoss = globalThis as unknown as { boss?: PgBoss };

export function getBoss(): PgBoss {
  if (globalForBoss.boss) return globalForBoss.boss;
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on("error", (err: Error) => logger.error({ err }, "pgboss.error"));
  globalForBoss.boss = boss;
  return boss;
}
