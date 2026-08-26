import { randomBytes } from "node:crypto";
import { argon2id, argon2Verify } from "hash-wasm";

// パスワードを変換するときの共通設定。
// 以前の部品と同じArgon2idの保存形式と、OWASPが示す設定値を使う。
const ARGON2_OPTIONS = {
  memorySize: 19456,
  iterations: 2,
  parallelism: 1,
  hashLength: 32,
} as const;

/** パスワードを、そのままでは元に戻せない標準のArgon2id形式へ変換する。 */
export async function hashPassword(plain: string): Promise<string> {
  return argon2id({
    password: plain,
    salt: randomBytes(16),
    ...ARGON2_OPTIONS,
    outputType: "encoded",
  });
}

/** 入力されたパスワードが、保存済みのArgon2id形式と一致するか確認する。 */
export function verifyPassword(encodedHash: string, plain: string): Promise<boolean> {
  return argon2Verify({ hash: encodedHash, password: plain });
}
