import { runMasterExcelExport } from "@/modules/master/jobs";
import { MASTER_EXCEL_EXPORT_QUEUE, type MasterExcelExportJobData } from "@/modules/master/types";
import { getBoss } from "@/shared/jobs/boss";
import { logger } from "@/shared/observability/logger";
import { withJob } from "@/shared/observability/with-job";
import type { Job, PgBoss } from "pg-boss";

// マスタ情報Excel取得（設計書§40）の依頼1件を処理する入口。開始・終了・失敗の記録は withJob が自動で残す。
// 公開窓口（@/modules/master/index.ts）を経由せず、生成処理のファイルを直接読み込んでいる。
// 公開窓口は画面の部品（UIコンポーネントなど）もまとめて公開しているため、そこから読み込むと
// 画面用の仕組みまで一緒に読み込まれてしまう。裏側のプログラム（worker）には不要なため。
const handleMasterExcelExportJob = withJob<Job<MasterExcelExportJobData>>(
  MASTER_EXCEL_EXPORT_QUEUE,
  (job) => runMasterExcelExport(job.data.exportId),
);

/**
 * 順番待ちの列（キュー）に溜まっている依頼を、無くなるまで順に処理する。
 * 1件処理するたびに次の依頼があるか確かめ、無くなった時点で戻る。
 * Cloud Run Jobsは「1回起動したら1回ぶんだけ動いて止まる」仕組みで使うため、
 * 常駐モードのように待ち受け続けず、ここで処理を終わらせる必要がある。
 */
async function drainMasterExcelExportQueue(boss: PgBoss): Promise<number> {
  let processedCount = 0;
  for (;;) {
    const jobs = await boss.fetch<MasterExcelExportJobData>(MASTER_EXCEL_EXPORT_QUEUE);
    if (jobs.length === 0) return processedCount;

    for (const job of jobs) {
      // 取り出した依頼は、処理の結果（成功・失敗）を自分で順番待ちの列へ伝える必要がある。
      // 伝えないと、その依頼はいつまでも「処理中」のまま列に残ってしまう。
      try {
        await handleMasterExcelExportJob(job);
        await boss.complete(MASTER_EXCEL_EXPORT_QUEUE, job.id);
      } catch {
        // 失敗した記録は withJob がすでに残しているため、ここでは結果を伝えるだけにする
        await boss.fail(MASTER_EXCEL_EXPORT_QUEUE, job.id);
      }
      processedCount += 1;
    }
  }
}

/**
 * 裏側で動き続けるプログラムの入口。
 * マスタ情報Excel取得の依頼（順番待ちの列: `master.excel-export`）を処理する。
 * 実行モードは2つある。
 *   常駐（既定）: ローカル・docker compose での起動を想定し、依頼が来るたびに処理しながら、
 *                シグナルを受けるまで待ち受け続ける。
 *   単発（--once）: Cloud Run Jobs での起動を想定し、溜まっている依頼を全部処理してから終了する。
 */
async function main(): Promise<void> {
  const once = process.argv.includes("--once");

  const boss = getBoss();
  // 順番待ちの管理に使うテーブルは、この開始処理の中で自動的に作られる
  await boss.start();
  // 依頼がまだ一度も出されていない場合、順番待ちの列そのものが存在しない。
  // 存在しない列から取り出そうとすると失敗するため、ここで用意しておく（すでにあれば何もしない）。
  await boss.createQueue(MASTER_EXCEL_EXPORT_QUEUE);

  if (once) {
    logger.info("worker 起動完了: pg-boss ready（単発実行）");
    const processedCount = await drainMasterExcelExportQueue(boss);
    logger.info({ processedCount }, "処理すべき依頼が無くなったため、worker を終了します");
    await boss.stop({ graceful: true });
    process.exit(0);
  }

  logger.info("worker 起動完了: pg-boss ready（アイドル待受）");

  // 順番待ちの列を見張り、依頼が来たら処理する。結果（成功・失敗）に応じた
  // 順番待ちの列への報告は、pg-boss がこの処理の成功・失敗を見て自動的に行う。
  await boss.work<MasterExcelExportJobData>(MASTER_EXCEL_EXPORT_QUEUE, async (jobs) => {
    for (const job of jobs) await handleMasterExcelExportJob(job);
  });

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
