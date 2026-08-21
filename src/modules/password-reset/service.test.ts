/**
 * 対象: password-reset/service requestReset
 * 目的: 未登録アドレス・削除済み利用者・送信回数の上限超過のいずれでも同じ結果（メールを送らない）
 *       になること、発行時に古い未使用の再設定用URLを無効にしてから新しい合言葉を発行・送信する
 *       ことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PasswordResetToken, User } from "@prisma/client";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/shared/mail", () => ({ sendMail: sendMailMock }));

// 実際に記録を出力すると試験の出力が読みにくくなるため、記録係を差し替える
const { childLoggerMock } = vi.hoisted(() => {
  const childLoggerMock = vi.fn(() => ({ info: vi.fn() }));
  return { childLoggerMock };
});
vi.mock("@/shared/observability/logger", () => ({ childLogger: childLoggerMock }));

vi.mock("@/modules/password-reset/repository", () => ({
  passwordResetRepository: {
    findUserByEmail: vi.fn(),
    countRecentTokens: vi.fn(),
    invalidateActiveTokens: vi.fn(),
    create: vi.fn(),
  },
}));

import { passwordResetRepository } from "@/modules/password-reset/repository";
import { passwordResetService } from "@/modules/password-reset/service";

// テストで使う最小限のUserレコードを組み立てる
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    role: "VIEWER",
    passwordHash: null,
    failedAttempts: 0,
    lockedAt: null,
    mustChangePassword: false,
    externalId: null,
    email: "user@example.com",
    displayName: null,
    deleted: false,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("password-reset/service requestReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(passwordResetRepository.countRecentTokens).mockResolvedValue(0);
    vi.mocked(passwordResetRepository.create).mockResolvedValue({} as PasswordResetToken);
  });

  describe("正常系", () => {
    it("メールアドレスを小文字へ揃えて利用者を探す", async () => {
      vi.mocked(passwordResetRepository.findUserByEmail).mockResolvedValue(buildUser());

      await passwordResetService.requestReset({ email: "User@Example.com" });

      expect(passwordResetRepository.findUserByEmail).toHaveBeenCalledWith("user@example.com");
    });

    it("古い未使用のURLを無効にしてから、新しい合言葉を発行してメールを送る", async () => {
      const user = buildUser({ id: "user-1", email: "user@example.com", displayName: "山田太郎" });
      vi.mocked(passwordResetRepository.findUserByEmail).mockResolvedValue(user);

      await passwordResetService.requestReset({ email: "user@example.com" });

      const invalidateOrder = vi.mocked(passwordResetRepository.invalidateActiveTokens).mock
        .invocationCallOrder[0];
      const createOrder = vi.mocked(passwordResetRepository.create).mock.invocationCallOrder[0];
      expect(invalidateOrder).toBeLessThan(createOrder);

      expect(passwordResetRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "user-1", tokenHash: expect.any(String) }),
      );
      expect(sendMailMock).toHaveBeenCalledWith({
        to: "user@example.com",
        template: expect.objectContaining({
          kind: "password-reset",
          userId: "user-1",
          displayName: "山田太郎",
          token: expect.any(String),
        }),
      });
    });
  });

  describe("利用者が見つからない場合", () => {
    it("メールを送らず、URLも発行しない", async () => {
      vi.mocked(passwordResetRepository.findUserByEmail).mockResolvedValue(null);

      await passwordResetService.requestReset({ email: "unknown@example.com" });

      expect(passwordResetRepository.invalidateActiveTokens).not.toHaveBeenCalled();
      expect(passwordResetRepository.create).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe("利用者が削除済みの場合", () => {
    it("メールを送らず、URLも発行しない", async () => {
      vi.mocked(passwordResetRepository.findUserByEmail).mockResolvedValue(
        buildUser({ deleted: true }),
      );

      await passwordResetService.requestReset({ email: "user@example.com" });

      expect(passwordResetRepository.create).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe("24時間の発行回数が上限（5件）に達している場合", () => {
    it("メールを送らず、URLも発行しない", async () => {
      vi.mocked(passwordResetRepository.findUserByEmail).mockResolvedValue(buildUser());
      vi.mocked(passwordResetRepository.countRecentTokens).mockResolvedValue(5);

      await passwordResetService.requestReset({ email: "user@example.com" });

      expect(passwordResetRepository.invalidateActiveTokens).not.toHaveBeenCalled();
      expect(passwordResetRepository.create).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });
});
