import { isAppError } from "@/shared/errors/app-error";

/** 外部連携用の窓口が失敗したときに返す、共通の形 */
export interface ApiErrorBody {
  error: { code: string; message: string; requestId?: string };
}

/**
 * 発生したエラーを、外部へ返してよい応答の形に変換する。
 *
 * 業務上の理由によるエラーは、その種類と画面向けの文言をそのまま伝える。
 * 想定外の不具合は内容を伝えず、決まった文言に置き換える
 * （内部の作りや設定が外部に漏れないようにするため）。
 *
 * ※ 記録を残すのは呼び出し元（with-route）の役割なので、ここでは残さない。
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
