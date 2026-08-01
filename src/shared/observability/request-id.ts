import { randomUUID } from "node:crypto";

/** リクエスト相関ID（requestId）を発番する。ログ・エラー画面の突合キー。 */
export function newRequestId(): string {
  return randomUUID();
}
