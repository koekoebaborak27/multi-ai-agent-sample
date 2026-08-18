/**
 * 対象: user/service resolveDisplayNames
 * 目的: 利用者IDから表示名への変換が、表示名の有無・該当利用者の有無・重複IDのいずれでも
 *       正しく行われることを担保する
 */
import { userRepository } from "@/modules/user/repository";
import { userService } from "@/modules/user/service";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/user/repository", () => ({
  userRepository: {
    findManyByIds: vi.fn(),
  },
}));

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
