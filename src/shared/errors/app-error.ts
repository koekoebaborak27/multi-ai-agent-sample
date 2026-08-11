/**
 * このアプリ全体で使う、業務上の理由で処理を続けられないことを表すエラー。
 * 各処理ではこのエラーを発生させるだけでよく、記録を残すのは処理の入口の 1 箇所だけ。
 *
 *  - code:        エラーの種類を表す名前。この文字列で検索して発生箇所を探せる（例 "MASTER_NOT_FOUND"）
 *  - httpStatus:  外部へ応答を返すときに使う番号（見つからない・権限が無い、などの区別）
 *  - userMessage: 画面にそのまま表示してよい文言。内部の事情が漏れない内容にする
 *  - context:     原因を切り分けるための補足情報。隠すべき項目は記録する側で伏せ字にする
 */
export class AppError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  readonly userMessage: string;
  readonly context?: Record<string, unknown>;

  constructor(
    code: string,
    httpStatus: number,
    userMessage: string,
    context?: Record<string, unknown>,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options);
    this.name = "AppError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.userMessage = userMessage;
    this.context = context;
  }
}

/** 業務上の理由によるエラーかどうかを判定する。想定外の不具合と区別するために使う */
export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// よく使うエラーを組み立てる関数をまとめたもの。
// 機能ごとに個別の理由が必要な場合は、これを使わず AppError を直接組み立てて独自の名前を付けてよい。
export const Errors = {
  notFound: (userMessage = "対象が見つかりません", context?: Record<string, unknown>) =>
    new AppError("NOT_FOUND", 404, userMessage, context),
  unauthorized: (userMessage = "認証が必要です", context?: Record<string, unknown>) =>
    new AppError("UNAUTHORIZED", 401, userMessage, context),
  forbidden: (userMessage = "権限がありません", context?: Record<string, unknown>) =>
    new AppError("FORBIDDEN", 403, userMessage, context),
  validation: (userMessage = "入力内容に誤りがあります", context?: Record<string, unknown>) =>
    new AppError("VALIDATION_ERROR", 422, userMessage, context),
  conflict: (userMessage = "競合が発生しました", context?: Record<string, unknown>) =>
    new AppError("CONFLICT", 409, userMessage, context),
};
