import { isAppError } from "@/shared/errors/app-error";

export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string };
}

/**
 * 例外を HTTP レスポンス(JSON)に変換する。
 * AppError は code/userMessage/httpStatus を反映し、想定外は 500 + 汎用文言。
 * ※ ログ出力は境界ラッパー(with-route)が済ませている前提（ここでは出さない）。
 */
export function toApiErrorResponse(err: unknown, requestId?: string): Response {
  if (isAppError(err)) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.userMessage, requestId },
    };
    return Response.json(body, { status: err.httpStatus });
  }
  const body: ApiErrorBody = {
    error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました", requestId },
  };
  return Response.json(body, { status: 500 });
}
