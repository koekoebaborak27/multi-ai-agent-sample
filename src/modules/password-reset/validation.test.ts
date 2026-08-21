/**
 * 対象: password-reset/validation forgotPasswordSchema
 * 目的: メールアドレスの必須・形式・文字数の入力チェックを担保する
 */
import { describe, expect, it } from "vitest";
import { forgotPasswordSchema } from "@/modules/password-reset/validation";

describe("password-reset/validation forgotPasswordSchema", () => {
  describe("正常系", () => {
    it("正しい形式のメールアドレスを受け付ける", () => {
      const result = forgotPasswordSchema.safeParse({ email: "user@example.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("メールアドレスが空の場合", () => {
    it("「メールアドレスを入力してください」を返す", () => {
      const result = forgotPasswordSchema.safeParse({ email: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスを入力してください");
      }
    });
  });

  describe("メールアドレスの形式が誤っている場合", () => {
    it("「メールアドレスの形式が正しくありません」を返す", () => {
      const result = forgotPasswordSchema.safeParse({ email: "not-an-email" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスの形式が正しくありません");
      }
    });
  });

  describe("メールアドレスが254文字を超える場合", () => {
    it("「メールアドレスが長すぎます」を返す", () => {
      const email = `${"a".repeat(250)}@ex.com`; // 262文字（形式は正しい）
      const result = forgotPasswordSchema.safeParse({ email });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスが長すぎます");
      }
    });
  });
});
