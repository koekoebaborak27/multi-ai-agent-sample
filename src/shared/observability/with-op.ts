import { performance } from "node:perf_hooks";
import type { Logger } from "pino";
import { childLogger } from "@/shared/observability/logger";
import { newRequestId } from "@/shared/observability/request-id";

/**
 * 記録に添える「誰が操作したか」を調べる。
 *
 * ログインの仕組みを直接読み込まず、必要になった時点で読み込んでいる。
 * この記録の仕組みは、画面からの操作だけでなく、ログインという考え方が無い
 * 定期実行の処理からも使うため、常に読み込む形にすると動かせなくなるから。
 * 利用者が分からない場合は、何も付けずに空のまま返す。
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

/**
 * 記録に残す入力内容を整える。
 * 内容が大きすぎるとログが読みにくくなるため、一定の大きさを超えたら長さだけを残す。
 * パスワードなどの隠すべき項目は、ログを出力する側の設定で伏せ字にしている。
 */
function summarizeArgs(args: unknown[]): unknown {
  try {
    const json = JSON.stringify(args);
    if (json && json.length > 2000) return { _truncated: true, length: json.length };
    return args;
  } catch {
    return { _unserializable: true };
  }
}

/** 1回の処理を通して使う記録用の情報 */
export interface OpContext {
  requestId: string;
  log: Logger;
}

/** 記録の取り方を変えるための設定 */
export interface WithOpOptions {
  /** 変更前後の値など、後から追跡したい入力内容を、成功したときの記録にも残す */
  includeArgsInSuccessLog?: boolean;
}

/**
 * 「別の画面へ移動する」「見つからない画面を表示する」という指示かどうかを判定する。
 *
 * これらは失敗ではないが、仕組みの都合でエラーと同じ形で伝えられる。
 * そのまま扱うと正常な画面移動がすべて異常として記録されてしまうため、ここで見分けている。
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
 * 保存などの処理を包み、その処理の記録を自動的に残すようにする。
 *
 * 開始したこと・終わったことと所要時間・失敗したことを、それぞれ記録する。
 * これがあるおかげで、個々の業務処理の中に記録を残す処理を書く必要が無い。
 * 業務処理側はエラーを発生させるだけでよく、記録はここで 1 回だけ残る。
 */
export function withOp<A extends unknown[], R>(
  op: string,
  fn: (...args: A) => Promise<R>,
  options?: WithOpOptions,
): (...args: A) => Promise<R> {
  return async (...args: A): Promise<R> => {
    // 1回の処理に固有の番号。同じ処理から出た記録を後からまとめて探せるようにする
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
        // 画面移動の指示は失敗ではないため、成功として記録したうえでそのまま渡す
        log.info(
          {
            ms: Math.round(performance.now() - start),
            ...(options?.includeArgsInSuccessLog ? { args: summarizeArgs(args) } : {}),
          },
          `✓ ${op} (redirect)`,
        );
        throw err;
      }
      // 失敗の記録を残すのはこの1箇所だけ。処理の番号・名前・発生場所・所要時間をまとめて残す。
      log.error(
        { err, ms: Math.round(performance.now() - start), args: summarizeArgs(args) },
        `✗ ${op}`,
      );
      throw err;
    }
  };
}
