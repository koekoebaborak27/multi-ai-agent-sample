import { getBoss } from "@/shared/jobs/boss";
import { logger } from "@/shared/observability/logger";

/**
 * 裏側で動き続けるプログラムの入口。
 * 現時点では処理するキューが登録されていない雛形。時間のかかる処理を追加する際は、
 * ここでキューの購読（`boss.work(...)`）を追加する。
 * 実行モードは2つある。
 *   常駐（既定）: ローカル・docker compose での起動を想定し、シグナルを受けるまで待ち受け続ける。
 *   単発（--once）: Cloud Run Jobs での起動を想定し、起動したらすぐ終了する。
 */
async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  const boss = getBoss();
  // 順番待ちの管理に使うテーブルは、この開始処理の中で自動的に作られる
  await boss.start();

  if (once) {
    logger.info("worker 起動完了: pg-boss ready（単発実行）");
    logger.info("処理すべきジョブが無いため、worker を終了します");
    await boss.stop({ graceful: true });
    process.exit(0);
  }

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
