import { PgBoss } from "pg-boss";
import { env } from "@/shared/config/env";
import { logger } from "@/shared/observability/logger";

/**
 * 時間のかかる処理を後回しにして順番に実行するための仕組み。
 *
 * 画面側はここへ処理を積み、裏側で動くプログラムがそれを取り出して実行する。
 * 順番待ちの管理に使うテーブルは、この仕組みが自分で作るため、
 * このアプリのデータベース定義には含めていない。
 */
const globalForBoss = globalThis as unknown as { boss?: PgBoss };

// 順番待ちの仕組みを取得する。すでに作られていればそれを使い回す。
export function getBoss(): PgBoss {
  if (globalForBoss.boss) return globalForBoss.boss;
  const boss = new PgBoss({ connectionString: env.DATABASE_URL });
  boss.on("error", (err: Error) => logger.error({ err }, "pgboss.error"));
  globalForBoss.boss = boss;
  return boss;
}
