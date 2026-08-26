/**
 * 対象: auth/service hashPassword・verifyCredentials・provisionEntraUser・changePassword
 * 目的: ID/パスワードでのログイン判定（利用者不在・削除済み・利用停止中・パスワード不一致・
 *       失敗回数の上限到達での自動ロック・成功時の失敗回数リセット）、Microsoftアカウントでの
 *       利用者との紐付け（削除済み・利用停止中の拒否）、パスワード変更（本人確認・Microsoft専用
 *       利用者の対象外扱い）の業務ルールを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import { isAppError } from "@/shared/errors/app-error";

const { hashMock, verifyMock } = vi.hoisted(() => ({
  hashMock: vi.fn(),
  verifyMock: vi.fn(),
}));
vi.mock("@/shared/security/password", () => ({
  hashPassword: hashMock,
  verifyPassword: verifyMock,
}));

vi.mock("@/shared/config/env", () => ({ env: { MAX_ATTEMPTS: 5 } }));

vi.mock("@/modules/auth/repository", () => ({
  authRepository: {
    findById: vi.fn(),
    findByExternalId: vi.fn(),
    incrementFailedAttempts: vi.fn(),
    resetFailedAttempts: vi.fn(),
    lock: vi.fn(),
    updatePassword: vi.fn(),
    upsertEntraUser: vi.fn(),
  },
}));

import { authRepository } from "@/modules/auth/repository";
import { authService } from "@/modules/auth/service";

// テストで使う最小限のUserレコードを組み立てる
function buildUser(overrides: Partial<User> = {}): User {
  return {
    id: "user-1",
    role: "VIEWER",
    passwordHash: "stored-hash",
    failedAttempts: 0,
    lockedAt: null,
    mustChangePassword: false,
    externalId: null,
    email: "user@example.com",
    displayName: "山田太郎",
    deleted: false,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("auth/service hashPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("変換用の関数へ入力の文字列をそのまま渡し、結果を返す", async () => {
      hashMock.mockResolvedValue("hashed-password");

      const result = await authService.hashPassword("plain-password");

      expect(hashMock).toHaveBeenCalledWith("plain-password");
      expect(result).toBe("hashed-password");
    });
  });
});

describe("auth/service verifyCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("パスワードが一致するとき、失敗回数をリセットして利用者情報を返す", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockResolvedValue(true);

      const result = await authService.verifyCredentials("user-1", "correct-password");

      expect(authRepository.resetFailedAttempts).toHaveBeenCalledWith("user-1");
      expect(authRepository.incrementFailedAttempts).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: "user-1",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
        name: "山田太郎",
        email: "user@example.com",
      });
    });

    it("役割が想定外の値のとき、閲覧のみの役割として扱う", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser({ role: "UNKNOWN_ROLE" }));
      verifyMock.mockResolvedValue(true);

      const result = await authService.verifyCredentials("user-1", "correct-password");

      expect(result.role).toBe("VIEWER");
    });
  });

  describe("利用者が見つからない場合", () => {
    it("AppError(UNAUTHORIZED)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(null);

      const result = await authService.verifyCredentials("unknown", "any").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
    });
  });

  describe("利用者が削除済みの場合", () => {
    it("AppError(UNAUTHORIZED)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser({ deleted: true }));

      const result = await authService.verifyCredentials("user-1", "any").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
    });
  });

  describe("アカウントが利用停止中の場合", () => {
    it("AppError(ACCOUNT_LOCKED)を投げ、パスワードの照合は行わない", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(
        buildUser({ lockedAt: new Date("2026-08-01T00:00:00.000Z") }),
      );

      const result = await authService.verifyCredentials("user-1", "any").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("ACCOUNT_LOCKED");
      expect(verifyMock).not.toHaveBeenCalled();
    });
  });

  describe("Microsoftアカウント専用の利用者（パスワード未設定）の場合", () => {
    it("AppError(UNAUTHORIZED)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser({ passwordHash: null }));

      const result = await authService.verifyCredentials("user-1", "any").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
      expect(verifyMock).not.toHaveBeenCalled();
    });
  });

  describe("パスワードが一致しない場合", () => {
    it("失敗回数が上限未満なら、回数を1増やしてAppError(UNAUTHORIZED)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockResolvedValue(false);
      vi.mocked(authRepository.incrementFailedAttempts).mockResolvedValue(3);

      const result = await authService.verifyCredentials("user-1", "wrong").catch((e) => e);

      expect(authRepository.incrementFailedAttempts).toHaveBeenCalledWith("user-1");
      expect(authRepository.lock).not.toHaveBeenCalled();
      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
    });

    it("失敗回数が上限（MAX_ATTEMPTS）に達したら、利用停止にしてAppError(ACCOUNT_LOCKED)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockResolvedValue(false);
      vi.mocked(authRepository.incrementFailedAttempts).mockResolvedValue(5);

      const result = await authService.verifyCredentials("user-1", "wrong").catch((e) => e);

      expect(authRepository.lock).toHaveBeenCalledWith("user-1");
      expect(isAppError(result) && result.code).toBe("ACCOUNT_LOCKED");
    });

    it("照合処理自体が例外を投げても、不一致として扱い失敗回数を増やす", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockRejectedValue(new Error("native error"));
      vi.mocked(authRepository.incrementFailedAttempts).mockResolvedValue(1);

      const result = await authService.verifyCredentials("user-1", "wrong").catch((e) => e);

      expect(authRepository.incrementFailedAttempts).toHaveBeenCalledWith("user-1");
      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
    });
  });
});

describe("auth/service provisionEntraUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("紐付け済みの利用者情報を、authMethod entra として返す", async () => {
      vi.mocked(authRepository.upsertEntraUser).mockResolvedValue(
        buildUser({ externalId: "entra-oid-1" }),
      );

      const result = await authService.provisionEntraUser({
        externalId: "entra-oid-1",
        email: "user@example.com",
        name: "山田太郎",
      });

      expect(authRepository.upsertEntraUser).toHaveBeenCalledWith({
        externalId: "entra-oid-1",
        email: "user@example.com",
        name: "山田太郎",
      });
      expect(result.authMethod).toBe("entra");
    });
  });

  describe("利用者が削除済みの場合", () => {
    it("AppError(ACCOUNT_DISABLED)を投げる", async () => {
      vi.mocked(authRepository.upsertEntraUser).mockResolvedValue(buildUser({ deleted: true }));

      const result = await authService
        .provisionEntraUser({ externalId: "entra-oid-1" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("ACCOUNT_DISABLED");
    });
  });

  describe("利用者が利用停止中の場合", () => {
    it("AppError(ACCOUNT_DISABLED)を投げる", async () => {
      vi.mocked(authRepository.upsertEntraUser).mockResolvedValue(
        buildUser({ lockedAt: new Date("2026-08-01T00:00:00.000Z") }),
      );

      const result = await authService
        .provisionEntraUser({ externalId: "entra-oid-1" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("ACCOUNT_DISABLED");
    });
  });
});

describe("auth/service changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("現在のパスワードが一致するとき、変換した新しいパスワードで更新する", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockResolvedValue(true);
      hashMock.mockResolvedValue("new-hashed-password");

      await authService.changePassword("user-1", "current-password", "new-password");

      expect(authRepository.updatePassword).toHaveBeenCalledWith("user-1", "new-hashed-password");
    });
  });

  describe("対象の利用者が見つからない場合", () => {
    it("AppError(NOT_FOUND)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(null);

      const result = await authService.changePassword("unknown", "current", "new").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("NOT_FOUND");
      expect(authRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe("Microsoftアカウント専用の利用者（パスワード未設定）の場合", () => {
    it("AppError(FORBIDDEN)を投げる", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser({ passwordHash: null }));

      const result = await authService.changePassword("user-1", "current", "new").catch((e) => e);

      expect(isAppError(result) && result.code).toBe("FORBIDDEN");
      expect(authRepository.updatePassword).not.toHaveBeenCalled();
    });
  });

  describe("現在のパスワードが一致しない場合", () => {
    it("AppError(UNAUTHORIZED)を投げ、更新は行わない", async () => {
      vi.mocked(authRepository.findById).mockResolvedValue(buildUser());
      verifyMock.mockResolvedValue(false);

      const result = await authService
        .changePassword("user-1", "wrong-current", "new")
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("UNAUTHORIZED");
      expect(authRepository.updatePassword).not.toHaveBeenCalled();
    });
  });
});
