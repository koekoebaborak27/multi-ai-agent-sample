import { randomUUID } from "node:crypto";

/**
 * 1回の処理に固有の番号を作る。
 * 同じ処理から出た記録をまとめて探すときや、
 * 利用者に見えたエラー画面の番号から該当の記録を探すときに使う。
 */
export function newRequestId(): string {
  return randomUUID();
}
