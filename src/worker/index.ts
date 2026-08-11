import { getBoss } from "@/shared/jobs/boss";
import { logger } from "@/shared/observability/logger";

/**
 * 裏側で動き続けるプログラムの入口。
 * 順番待ちに積まれた処理を取り出して実行する役割だが、
 * 現時点では実行する処理をまだ登録しておらず、待ち受けるだけになっている。
 * 処理を追加するときは、この関数の中で「どの順番待ちを担当するか」を登録する。
 */
async function main(): Promise<void> {
  const boss = getBoss();
  // 順番待ちの管理に使うテーブルは、この開始処理の中で自動的に作られる
  await boss.start();
  logger.info("worker 起動完了: pg-boss ready（アイドル待受）");

  // 停止の指示を受けたら、実行中の処理が終わるのを待ってから止める。
  // 途中で打ち切ると、処理が中途半端な状態のまま残ってしまうため。
  const shutdown = async (signal: string) => {
    logger.info({ signal }, "worker をシャットダウンします");
    await boss.stop({ graceful: true });
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

// 起動に失敗したときは、記録を残したうえで異常終了する。
// 動かないまま起動したことになってしまうと、原因に気付けないため。
main().catch((err) => {
  logger.error({ err }, "worker の起動に失敗しました");
  process.exit(1);
});
