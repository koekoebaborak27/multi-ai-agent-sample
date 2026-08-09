import { performance } from "node:perf_hooks";
import type { Logger } from "pino";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";

/**
 * 現在のユーザーを動的 import で解決する（observability が auth に静的依存しないため）。
 * リクエストスコープ外（worker 等）では取得できず {} を返す。
 */
async function resolveUserCtx(): Promise<{ userId?: string; role?: string }> {
  try {
    const mod = await import("@/shared/auth/session");
    const user = await mod.getCurrentUser();
    return user ? { userId: user.id, role: user.role } : {};
  } catch {
    return {};
  }
}

/** 引数を安全にログ用へ要約（巨大値を避け、機密は logger の redact に委ねる） */
function summarizeArgs(args: unknown[]): unknown {
  try {
    const json = JSON.stringify(args);
    if (json && json.length > 2000) return { _truncated: true, length: json.length };
    return args;
  } catch {
    return { _unserializable: true };
  }
}

export interface OpContext {
  requestId: string;
  log: Logger;
}

export interface WithOpOptions {
  /** 変更前後の値など、監査に必要な引数を成功時のinfoログにも含める。 */
  includeArgsInSuccessLog?: boolean;
}

/**
 * Next.js の制御フロー例外（redirect/notFound）は「正常系」。
 * これらをエラーとして記録しない（成功扱いで再スローする）。
 */
function isControlFlowError(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_REDIRECT") ||
      digest === "NEXT_NOT_FOUND" ||
      digest.startsWith("NEXT_HTTP_ERROR_FALLBACK"))
  );
}

/**
 * Server Action 等を包む境界ラッパー（§9 の中核）。
 * 開始(debug)・終了+所要時間(info)・例外(error) を自動出力する。
 * 業務コードは try/catch もログも書かず、throw するだけでよい（log once at the boundary）。
 */
export function withOp<A extends unknown[], R>(
  op: string,
  fn: (...args: A) => Promise<R>,
  options?: WithOpOptions,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    const requestId = newRequestId();
    const userCtx = await resolveUserCtx();
    const log = childLogger({ op, requestId, ...userCtx });
    const start = performance.now();
    log.debug({ args: summarizeArgs(args) }, `▶ ${op}`);
    try {
      const result = await fn(...args);
      log.info(
        {
          ms: Math.round(performance.now() - start),
          ...(options?.includeArgsInSuccessLog ? { args: summarizeArgs(args) } : {}),
        },
        `✓ ${op}`,
      );
      return result;
    } catch (err) {
      if (isControlFlowError(err)) {
        // redirect/notFound は正常系。成功扱いで再スロー。
        log.info(
          {
            ms: Math.round(performance.now() - start),
            ...(options?.includeArgsInSuccessLog ? { args: summarizeArgs(args) } : {}),
          },
          `✓ ${op} (redirect)`,
        );
        throw err;
      }
      // エラーログの唯一の出力点。requestId / op / stack / 所要時間つきで1レコード。
      log.error(
        { err, ms: Math.round(performance.now() - start), args: summarizeArgs(args) },
        `✗ ${op}`,
      );
      throw err;
    }
  };
}
