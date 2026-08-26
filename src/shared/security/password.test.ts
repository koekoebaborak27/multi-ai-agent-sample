/**
 * 対象: shared/security/password
 * 目的: OS専用の追加部品を使わず、標準のArgon2id形式でパスワードを作成・照合できることを担保する
 */
import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/shared/security/password";

describe("shared/security/password", () => {
  it("標準のArgon2id形式を作成し、正しいパスワードだけを一致と判定する", async () => {
    const encodedHash = await hashPassword("correct-password");

    expect(encodedHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await expect(verifyPassword(encodedHash, "correct-password")).resolves.toBe(true);
    await expect(verifyPassword(encodedHash, "wrong-password")).resolves.toBe(false);
  });
});
