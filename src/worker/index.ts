// UIコンポーネントやServer Action（"use server"）を巻き込まないよう、モジュールの窓口（index.ts）を
// 経由せず service.ts / types.ts を直接importする（設計書§13.5.2「業務処理はservice.tsを呼ぶ」）。
import { masterService } from "@/modules/master/service";
import { MASTER_EXPORT_QUEUE } from "@/modules/master/types";
import { getBoss } from "@/shared/jobs/boss";
import { logger } from "@/shared/observability/logger";
import { withJob } from "@/shared/observability/with-job";
import type { Job, PgBoss } from "pg-boss";

// 単発モード（Cloud Run Jobs）で、キューが空だと判断するまで待つ間隔・時間（§13.7.2）。
// 依頼とジョブ登録のコミットが、起動要求より後になる可能性があるため、即座には終了しない。
const ONCE_POLL_INTERVAL_MS = 2000;
const ONCE_IDLE_TIMEOUT_MS = 5000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// キュー master.export の処理を1件登録する。CSVを組み立てる業務処理は masterService 側に書かれており、
// ここでは呼び出すだけにする（§13.5.2）。
const handleExportJob = withJob(
  MASTER_EXPORT_QUEUE,
  async (job: Job<{ exportId: string }>): Promise<void> => {
    await masterService.processExport(job.data.exportId);
  },
);

// キューが空（順番待ち・処理中のジョブがどちらも無い）状態が ONCE_IDLE_TIMEOUT_MS 続くまで待つ。
// 単発モードの終了条件に使う。
async function waitUntilQueueIsIdle(boss: PgBoss): Promise<void> {
  let idleSince: number | null = null;
  for (;;) {
    const stats = await boss.getQueueStats(MASTER_EXPORT_QUEUE);
    const pending = stats.queuedCount + stats.activeCount;
    if (pending === 0) {
      idleSince ??= Date.now();
      if (Date.now() - idleSince >= ONCE_IDLE_TIMEOUT_MS) return;
    } else {
      idleSince = null;
    }
    await sleep(ONCE_POLL_INTERVAL_MS);
  }
}

/**
 * 裏側で動き続けるプログラムの入口。
 * 順番待ちに積まれた処理を取り出して実行する役割を持つ。
 * 実行モードは2つある（§13.7.2）。
 *   常駐（既定）: ローカル・docker compose での起動を想定し、シグナルを受けるまで待ち受け続ける。
 *   単発（--once）: Cloud Run Jobs での起動を想定し、キューが空になったら自分で終了する。
 */
async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  const boss = getBoss();
  // 順番待ちの管理に使うテーブルは、この開始処理の中で自動的に作られる
  await boss.start();
  // 依頼側（service.ts）より先に起動した場合に備え、ここでもキューを作っておく
  await boss.createQueue(MASTER_EXPORT_QUEUE);
  await boss.work<{ exportId: string }>(MASTER_EXPORT_QUEUE, async (jobs) => {
    for (const job of jobs) {
      await handleExportJob(job);
    }
  });

  if (once) {
    logger.info("worker 起動完了: pg-boss ready（単発実行）");
    await waitUntilQueueIsIdle(boss);
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
