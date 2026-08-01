import { getBoss } from "@/shared/jobs/boss";
import { logger } from "@/shared/observability/logger";

/**
 * pg-boss ワーカー（§6）。今回は起動して待受するのみ（ジョブ登録は後続）。
 * 例: boss.work("queue", withJob("queue", handler)) を将来ここに追加する。
 */
async function main(): Promise<void> {
  const boss = getBoss();
  await boss.start(); // スキーマ/テーブルは pg-boss が自動作成
  logger.info("worker 起動完了: pg-boss ready（アイドル待受）");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker をシャットダウンします");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "worker の起動に失敗しました");
  process.exit(1);
});
