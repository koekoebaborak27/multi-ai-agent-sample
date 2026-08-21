/**
 * 対象: password-reset/validation forgotPasswordSchema・resetPasswordSchema・requestEmailChangeSchema
 * 目的: メールアドレスの必須・形式・文字数の入力チェックと、
 *       新しいパスワードの文字数・英数字混在・確認一致の入力チェック、
 *       メールアドレス変更申し込みの必須・形式・文字数・現在のアドレスと同一の場合の拒否を担保する
 */
import { describe, expect, it } from "vitest";
import {
  forgotPasswordSchema,
  requestEmailChangeSchema,
  resetPasswordSchema,
} from "@/modules/password-reset/validation";

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

describe("password-reset/validation resetPasswordSchema", () => {
  describe("正常系", () => {
    it("8文字以上・英数字混在・確認一致の入力を受け付ける", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "newpass1",
        confirmPassword: "newpass1",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("新しいパスワードが8文字未満の場合", () => {
    it("「新しいパスワードは8文字以上にしてください」を返す", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "pass1",
        confirmPassword: "pass1",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("新しいパスワードは8文字以上にしてください");
      }
    });
  });

  describe("新しいパスワードに英字が含まれない場合", () => {
    it("「英字を含めてください」を返す", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "12345678",
        confirmPassword: "12345678",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("英字を含めてください");
      }
    });
  });

  describe("新しいパスワードに数字が含まれない場合", () => {
    it("「数字を含めてください」を返す", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "newpassword",
        confirmPassword: "newpassword",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("数字を含めてください");
      }
    });
  });

  describe("確認用パスワードが一致しない場合", () => {
    it("「新しいパスワードが一致しません」を返す", () => {
      const result = resetPasswordSchema.safeParse({
        newPassword: "newpass1",
        confirmPassword: "newpass2",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("新しいパスワードが一致しません");
      }
    });
  });
});

describe("password-reset/validation requestEmailChangeSchema", () => {
  describe("正常系", () => {
    it("現在のアドレスと異なる、正しい形式のメールアドレスを受け付ける", () => {
      const result = requestEmailChangeSchema("old@example.com").safeParse({
        newEmail: "new@example.com",
      });
      expect(result.success).toBe(true);
    });

    it("現在のアドレスが未登録（null）でも受け付ける", () => {
      const result = requestEmailChangeSchema(null).safeParse({ newEmail: "new@example.com" });
      expect(result.success).toBe(true);
    });
  });

  describe("メールアドレスが空の場合", () => {
    it("「メールアドレスを入力してください」を返す", () => {
      const result = requestEmailChangeSchema("old@example.com").safeParse({ newEmail: "" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスを入力してください");
      }
    });
  });

  describe("メールアドレスの形式が誤っている場合", () => {
    it("「メールアドレスの形式が正しくありません」を返す", () => {
      const result = requestEmailChangeSchema("old@example.com").safeParse({
        newEmail: "not-an-email",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスの形式が正しくありません");
      }
    });
  });

  describe("メールアドレスが254文字を超える場合", () => {
    it("「メールアドレスが長すぎます」を返す", () => {
      const newEmail = `${"a".repeat(250)}@ex.com`; // 262文字（形式は正しい）
      const result = requestEmailChangeSchema("old@example.com").safeParse({ newEmail });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("メールアドレスが長すぎます");
      }
    });
  });

  describe("現在のメールアドレスと同じ場合（大文字・小文字の違いのみも含む）", () => {
    it("「現在のメールアドレスと同じです」を返す", () => {
      const result = requestEmailChangeSchema("old@example.com").safeParse({
        newEmail: "Old@Example.com",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe("現在のメールアドレスと同じです");
      }
    });
  });
});
