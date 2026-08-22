/**
 * 対象: user/validation 利用者の新規登録・更新フォームの入力チェック
 * 目的: メールアドレスの必須/任意の違いと、形式が不正な入力を弾くことを担保する
 */
import { createUserSchema, updateUserSchema } from "@/modules/user/validation";
import { describe, expect, it } from "vitest";

describe("user/validation createUserSchema", () => {
  describe("正常系", () => {
    it("必須項目が揃っていれば受け付ける", () => {
      const result = createUserSchema.safeParse({
        userId: "user-1",
        email: "user@example.com",
        role: "VIEWER",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("メールアドレスが未入力の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createUserSchema.safeParse({ userId: "user-1", email: "", role: "VIEWER" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("メールアドレスは必須です");
    });

    it("項目自体が無い場合も拒否する", () => {
      const result = createUserSchema.safeParse({ userId: "user-1", role: "VIEWER" });
      expect(result.success).toBe(false);
    });
  });

  describe("メールアドレスの形式が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      const result = createUserSchema.safeParse({
        userId: "user-1",
        email: "not-an-email",
        role: "VIEWER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("メール形式が不正です");
    });
  });
});

describe("user/validation updateUserSchema", () => {
  describe("正常系", () => {
    it("メールアドレスを含めて受け付ける", () => {
      const result = updateUserSchema.safeParse({
        userId: "user-1",
        email: "user@example.com",
        role: "VIEWER",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("メールアドレスが空の場合", () => {
    it("未登録のまま更新できるよう受け付ける", () => {
      const result = updateUserSchema.safeParse({ userId: "user-1", email: "", role: "VIEWER" });
      expect(result.success).toBe(true);
    });

    it("項目自体が無くても受け付ける", () => {
      const result = updateUserSchema.safeParse({ userId: "user-1", role: "VIEWER" });
      expect(result.success).toBe(true);
    });
  });

  describe("メールアドレスの形式が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      const result = updateUserSchema.safeParse({
        userId: "user-1",
        email: "not-an-email",
        role: "VIEWER",
      });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("メール形式が不正です");
    });
  });
});
