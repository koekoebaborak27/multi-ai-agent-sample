/**
 * 対象: password-reset/service requestReset・canOpen・resetPassword
 * 目的: 未登録アドレス・削除済み利用者・送信回数の上限超過のいずれでも同じ結果（メールを送らない）
 *       になること、発行時に古い未使用の再設定用URLを無効にしてから新しい合言葉を発行・送信する
 *       こと、再設定画面を開ける条件と、確定時に失敗回数・ロックが解除されることを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PasswordResetToken, User } from "@prisma/client";

const { sendMailMock } = vi.hoisted(() => ({ sendMailMock: vi.fn() }));
vi.mock("@/shared/mail", () => ({ sendMail: sendMailMock }));

const { hashPasswordMock } = vi.hoisted(() => ({ hashPasswordMock: vi.fn() }));
vi.mock("@/modules/auth", () => ({ authService: { hashPassword: hashPasswordMock } }));

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
    findValidToken: vi.fn(),
    resetPassword: vi.fn(),
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

// テストで使う最小限のPasswordResetTokenレコードを組み立てる
function buildToken(overrides: Partial<PasswordResetToken> = {}): PasswordResetToken {
  return {
    id: "token-1",
    userId: "user-1",
    tokenHash: "hash",
    expiresAt: new Date("2026-08-01T01:00:00.000Z"),
    usedAt: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("password-reset/service canOpen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("発行記録・利用者ともに有効な場合", () => {
    it("true を返す", async () => {
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue({
        token: buildToken(),
        user: buildUser(),
      });

      await expect(passwordResetService.canOpen("token")).resolves.toBe(true);
    });
  });

  describe("発行記録が見つからない・使用済み・期限切れ・利用者が無効のいずれかの場合", () => {
    it("false を返す", async () => {
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue(null);

      await expect(passwordResetService.canOpen("token")).resolves.toBe(false);
    });
  });
});

describe("password-reset/service resetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hashPasswordMock.mockResolvedValue("hashed-password");
  });

  describe("URLが無効な場合（使用済み・期限切れ・合言葉不一致・利用者不在/削除済み）", () => {
    it("RESET_TOKEN_INVALID を投げ、パスワードは更新しない", async () => {
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue(null);

      await expect(passwordResetService.resetPassword("token", "NewPass123")).rejects.toMatchObject(
        { code: "RESET_TOKEN_INVALID" },
      );

      expect(passwordResetRepository.resetPassword).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe("確定しようとした時点で発行記録が使用済み・期限切れに変わっていた場合", () => {
    it("RESET_TOKEN_INVALID を投げ、通知メールは送らない", async () => {
      const user = buildUser();
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue({
        token: buildToken(),
        user,
      });
      vi.mocked(passwordResetRepository.resetPassword).mockResolvedValue(false);

      await expect(passwordResetService.resetPassword("token", "NewPass123")).rejects.toMatchObject(
        { code: "RESET_TOKEN_INVALID" },
      );

      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });

  describe("正常系", () => {
    it("パスワードを変換して更新し、パスワード変更のお知らせメールを送る", async () => {
      const user = buildUser({ id: "user-1", email: "user@example.com", displayName: "山田太郎" });
      const token = buildToken({ id: "token-1", userId: "user-1" });
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue({ token, user });
      vi.mocked(passwordResetRepository.resetPassword).mockResolvedValue(true);

      await passwordResetService.resetPassword("token", "NewPass123");

      expect(hashPasswordMock).toHaveBeenCalledWith("NewPass123");
      expect(passwordResetRepository.resetPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenId: "token-1",
          userId: "user-1",
          passwordHash: "hashed-password",
        }),
      );
      expect(sendMailMock).toHaveBeenCalledWith({
        to: "user@example.com",
        template: expect.objectContaining({
          kind: "password-changed",
          userId: "user-1",
          displayName: "山田太郎",
        }),
      });
    });

    it("利用者にメールアドレスが無い場合は、通知メールを送らない", async () => {
      const user = buildUser({ email: null });
      const token = buildToken();
      vi.mocked(passwordResetRepository.findValidToken).mockResolvedValue({ token, user });
      vi.mocked(passwordResetRepository.resetPassword).mockResolvedValue(true);

      await passwordResetService.resetPassword("token", "NewPass123");

      expect(sendMailMock).not.toHaveBeenCalled();
    });
  });
});
