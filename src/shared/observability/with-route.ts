import { performance } from "node:perf_hooks";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";
import { resolveUserCtx } from "@/shared/observability/resolve-user-ctx";
import { toApiErrorResponse } from "@/shared/errors/handle-api-error";

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

/**
 * 外部連携用の窓口を包み、その処理の記録を自動的に残すようにする。
 *
 * 保存処理を包む withOp と役割は同じだが、失敗したときの扱いが異なる。
 * 呼び出し元が別のプログラムなので、エラー画面ではなく、
 * 内部の事情が漏れない形に整えた応答を返す。
 *
 * 応答には処理の番号を添える。問い合わせを受けたときに、その番号で記録を探せるようにするため。
 */
export function withRoute(op: string, handler: RouteHandler): RouteHandler {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    // 1回の処理に固有の番号。同じ処理から出た記録を後からまとめて探せるようにする
    const requestId = newRequestId();
    const userCtx = await resolveUserCtx();
    const log = childLogger({ op, requestId, method: req.method, url: req.url, ...userCtx });
    const start = performance.now();
    log.debug(`▶ ${op}`);
    try {
      const res = await handler(req, ctx);
      log.info({ ms: Math.round(performance.now() - start), status: res.status }, `✓ ${op}`);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      log.error({ err, ms: Math.round(performance.now() - start) }, `✗ ${op}`);
      // 失敗の内容をそのまま返さず、外部に見せてよい形へ変換してから返す
      const res = toApiErrorResponse(err, requestId);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  };
}
