/**
 * 対象: shared/mail/templates
 * 目的: パスワード再発行機能で送る4種類のメールが、設計書どおりの件名・本文で組み立てられることを担保する。
 *       表示名が無い利用者へはログインIDで宛名を組み立てること、
 *       URLの合言葉がAPP_BASE_URLに正しく続けて差し込まれることも確認する。
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/env", () => ({
  env: { APP_BASE_URL: "https://example.test" },
}));

import { buildTemplate } from "@/shared/mail/templates";

describe("shared/mail/templates", () => {
  describe("buildTemplate", () => {
    describe("password-reset", () => {
      it("件名・宛名・再設定URLを含む本文を組み立てる", () => {
        const { subject, body } = buildTemplate({
          kind: "password-reset",
          userId: "u001",
          displayName: "山田太郎",
          token: "abc123",
        });

        expect(subject).toBe("パスワード再設定のご案内");
        expect(body).toContain("山田太郎 様");
        expect(body).toContain("https://example.test/reset-password/abc123");
      });

      it("表示名が無い場合はログインIDを宛名に使う", () => {
        const { body } = buildTemplate({
          kind: "password-reset",
          userId: "u001",
          displayName: null,
          token: "abc123",
        });

        expect(body).toContain("u001 様");
      });
    });

    describe("password-changed", () => {
      it("件名と宛名を含む本文を組み立てる（URLは含まない）", () => {
        const { subject, body } = buildTemplate({
          kind: "password-changed",
          userId: "u001",
          displayName: "山田太郎",
        });

        expect(subject).toBe("パスワードを変更しました");
        expect(body).toContain("山田太郎 様");
        expect(body).not.toContain("http");
      });
    });

    describe("email-change-confirm", () => {
      it("件名・宛名・確認URLを含む本文を組み立てる", () => {
        const { subject, body } = buildTemplate({
          kind: "email-change-confirm",
          userId: "u001",
          displayName: "山田太郎",
          token: "xyz789",
        });

        expect(subject).toBe("メールアドレス変更の確認");
        expect(body).toContain("山田太郎 様");
        expect(body).toContain("https://example.test/settings/email/confirm/xyz789");
      });
    });

    describe("email-changed", () => {
      it("件名と宛名を含む本文を組み立てる（URLは含まない）", () => {
        const { subject, body } = buildTemplate({
          kind: "email-changed",
          userId: "u001",
          displayName: null,
        });

        expect(subject).toBe("メールアドレスを変更しました");
        expect(body).toContain("u001 様");
        expect(body).not.toContain("http");
      });
    });
  });
});
