import { performance } from "node:perf_hooks";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";

type JobHandler<T> = (job: T) => Promise<void> | void;

/**
 * pg-boss のジョブハンドラを包む境界ラッパー（§9）。
 * queue 名・jobId・requestId を束ねて開始/終了/例外を自動ログする。
 * 例外は再スローして pg-boss のリトライ/失敗処理に委ねる。
 */
export function withJob<T extends { id?: string }>(
  queue: string,
  handler: JobHandler<T>,
): JobHandler<T> {
  return async (job: T): Promise<void> => {
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
