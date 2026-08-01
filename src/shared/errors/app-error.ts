/**
 * アプリ共通の業務エラー（§9）。
 * service / repository では「throw するだけ」。ログ出力は境界ラッパー1箇所のみ。
 *  - code:        grep 可能なキー（例 "CONTRACT_NOT_FOUND"）
 *  - httpStatus:  API/Server Action で応答に変換する際の HTTP ステータス
 *  - userMessage: 画面に表示してよい安全な文言
 *  - context:     切り分け用の構造化フィールド（機密は logger 側で redact）
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

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}

// よく使う生成ヘルパ
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
