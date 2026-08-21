import { createHash, randomBytes } from "node:crypto";

// 合言葉（URLの末尾に付ける文字列）を新しく作る。
// 推測されないよう、暗号用途向けの乱数から作る。
export function createToken(): string {
  return randomBytes(32).toString("hex");
}

// 合言葉から要約値を計算する。
// データベースには合言葉そのものを保存せず、この値だけを保存する（漏れても合言葉には戻せない）。
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
