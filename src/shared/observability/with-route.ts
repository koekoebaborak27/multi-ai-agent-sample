import { performance } from "node:perf_hooks";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";
import { toApiErrorResponse } from "@/shared/errors/handle-api-error";

type RouteHandler = (req: Request, ctx?: unknown) => Promise<Response> | Response;

/**
 * API Route Handler を包む境界ラッパー（§9）。
 * 開始/終了/例外を自動ログし、例外は安全な JSON レスポンスへ変換する。
 * レスポンスヘッダに x-request-id を付与し、画面/ログ突合を可能にする。
 */
export function withRoute(op: string, handler: RouteHandler): RouteHandler {
  return async (req: Request, ctx?: unknown): Promise<Response> => {
    const requestId = newRequestId();
    const log = childLogger({ op, requestId, method: req.method, url: req.url });
    const start = performance.now();
    log.debug(`▶ ${op}`);
    try {
      const res = await handler(req, ctx);
      log.info({ ms: Math.round(performance.now() - start), status: res.status }, `✓ ${op}`);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      log.error({ err, ms: Math.round(performance.now() - start) }, `✗ ${op}`);
      const res = toApiErrorResponse(err, requestId);
      res.headers.set("x-request-id", requestId);
      return res;
    }
  };
}
