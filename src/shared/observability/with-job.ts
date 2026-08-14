import { performance } from "node:perf_hooks";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";

type JobHandler<T> = (job: T) => Promise<void> | void;

/**
 * 裏側で動く処理（順番待ちの列に入れて実行する処理）を包み、記録を自動的に残すようにする。
 *
 * 失敗したときは、記録を残したうえでそのまま呼び出し元へ伝える。
 * 実行を管理する仕組みがそれを受け取り、やり直すかどうかを判断するため、ここでは止めない。
 */
export function withJob<T extends { id?: string }>(
  queue: string,
  handler: JobHandler<T>,
): JobHandler<T> {
  return async (job: T): Promise<void> => {
    // 1回の処理に固有の番号。同じ処理から出た記録を後からまとめて探せるようにする
    const requestId = newRequestId();
    const log = childLogger({ op: `job:${queue}`, queue, jobId: job?.id, requestId });
    const start = performance.now();
    log.debug(`▶ job:${queue}`);
    try {
      await handler(job);
      log.info({ ms: Math.round(performance.now() - start) }, `✓ job:${queue}`);
    } catch (err) {
      log.error({ err, ms: Math.round(performance.now() - start) }, `✗ job:${queue}`);
      throw err;
    }
  };
}
