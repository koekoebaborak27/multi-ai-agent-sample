/**
 * 対象: user/service create・update・resolveDisplayNames
 * 目的: メールアドレスの重複チェックと小文字化、および利用者IDから表示名への変換が
 *       それぞれ正しく行われることを担保する
 */
import { userRepository } from "@/modules/user/repository";
import { userService } from "@/modules/user/service";
import { isAppError } from "@/shared/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

vi.mock("@/modules/user/repository", () => ({
  userRepository: {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    findManyByIds: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/modules/auth/service", () => ({
  authService: {
    hashPassword: vi.fn(),
  },
}));

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
    email: null,
    displayName: null,
    deleted: false,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    ...overrides,
  };
}

describe("user/service create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("メールアドレスを小文字へ揃えて登録する", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(userRepository.create).mockResolvedValue(
        buildUser({ id: "user-1", email: "user@example.com" }),
      );

      await userService.create({
        userId: "user-1",
        email: "User@Example.com",
        role: "VIEWER",
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith("user@example.com");
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: "user@example.com" }),
      );
    });
  });

  describe("ユーザーIDが既に存在する場合", () => {
    it("AppError(CONFLICT)を投げる", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(buildUser());

      const result = await userService
        .create({ userId: "user-1", email: "new@example.com", role: "VIEWER" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("CONFLICT");
    });
  });

  describe("メールアドレスが既に使われている場合", () => {
    it("AppError(CONFLICT)を投げる", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(buildUser({ id: "other-user" }));

      const result = await userService
        .create({ userId: "user-1", email: "used@example.com", role: "VIEWER" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("CONFLICT");
      expect(userRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe("user/service update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("正常系", () => {
    it("メールアドレスを小文字へ揃えて更新する", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(buildUser());
      vi.mocked(userRepository.findByEmail).mockResolvedValue(null);
      vi.mocked(userRepository.update).mockResolvedValue(buildUser({ email: "user@example.com" }));

      await userService.update({ userId: "user-1", email: "User@Example.com", role: "VIEWER" });

      expect(userRepository.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ email: "user@example.com" }),
      );
    });
  });

  describe("メールアドレスが空の場合", () => {
    it("未登録のまま（null）更新できる", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(buildUser());
      vi.mocked(userRepository.update).mockResolvedValue(buildUser());

      await userService.update({ userId: "user-1", email: "", role: "VIEWER" });

      expect(userRepository.findByEmail).not.toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ email: null }),
      );
    });
  });

  describe("対象の利用者が見つからない場合", () => {
    it("AppError(NOT_FOUND)を投げる", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(null);

      const result = await userService
        .update({ userId: "unknown", email: "", role: "VIEWER" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("NOT_FOUND");
    });
  });

  describe("メールアドレスが他の利用者に使われている場合", () => {
    it("AppError(CONFLICT)を投げる", async () => {
      vi.mocked(userRepository.findById).mockResolvedValue(buildUser({ id: "user-1" }));
      vi.mocked(userRepository.findByEmail).mockResolvedValue(buildUser({ id: "other-user" }));

      const result = await userService
        .update({ userId: "user-1", email: "used@example.com", role: "VIEWER" })
        .catch((e) => e);

      expect(isAppError(result) && result.code).toBe("CONFLICT");
      expect(userRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("メールアドレスが自分自身のものである場合", () => {
    it("重複扱いにせず更新できる", async () => {
      const existing = buildUser({ id: "user-1", email: "user@example.com" });
      vi.mocked(userRepository.findById).mockResolvedValue(existing);
      vi.mocked(userRepository.findByEmail).mockResolvedValue(existing);
      vi.mocked(userRepository.update).mockResolvedValue(existing);

      await userService.update({ userId: "user-1", email: "user@example.com", role: "VIEWER" });

      expect(userRepository.update).toHaveBeenCalledWith(
        "user-1",
        expect.objectContaining({ email: "user@example.com" }),
      );
    });
  });
});

describe("user/service resolveDisplayNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("表示名が設定されている利用者を渡した場合", () => {
    it("表示名を対応表に入れる", async () => {
      vi.mocked(userRepository.findManyByIds).mockResolvedValue([
        { id: "admin", displayName: "管理者太郎" },
      ]);

      const result = await userService.resolveDisplayNames(["admin"]);

      expect(userRepository.findManyByIds).toHaveBeenCalledWith(["admin"]);
      expect(result.get("admin")).toBe("管理者太郎");
    });
  });

  describe("表示名が未設定（null）の利用者を渡した場合", () => {
    it("IDをそのまま対応表に入れる", async () => {
      vi.mocked(userRepository.findManyByIds).mockResolvedValue([
        { id: "viewer", displayName: null },
      ]);

      const result = await userService.resolveDisplayNames(["viewer"]);

      expect(result.get("viewer")).toBe("viewer");
    });
  });

  describe("該当する利用者が見つからない場合", () => {
    it("IDをそのまま対応表に入れる", async () => {
      vi.mocked(userRepository.findManyByIds).mockResolvedValue([]);

      const result = await userService.resolveDisplayNames(["deleted-user"]);

      expect(result.get("deleted-user")).toBe("deleted-user");
    });
  });

  describe("空配列を渡した場合", () => {
    it("問い合わせせず空の対応表を返す", async () => {
      const result = await userService.resolveDisplayNames([]);

      expect(userRepository.findManyByIds).not.toHaveBeenCalled();
      expect(result.size).toBe(0);
    });
  });

  describe("同じIDが複数回含まれる場合", () => {
    it("重複を取り除いた配列でfindManyByIdsを呼び出す", async () => {
      vi.mocked(userRepository.findManyByIds).mockResolvedValue([
        { id: "admin", displayName: "管理者太郎" },
      ]);

      const result = await userService.resolveDisplayNames(["admin", "admin", "admin"]);

      expect(userRepository.findManyByIds).toHaveBeenCalledWith(["admin"]);
      expect(result.get("admin")).toBe("管理者太郎");
      expect(result.size).toBe(1);
    });
  });
});
