/**
 * 対象: master/service マスタ分類一覧・詳細・登録・更新
 * 目的: 表示形式、重複防止、監査項目および楽観的排他制御を担保する
 */
import { masterRepository } from "@/modules/master/repository";
import { formatMasterCategoryCode, masterService } from "@/modules/master/service";
import { AppError } from "@/shared/errors/app-error";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    listCategoriesAndCount: vi.fn(),
    findCategoryByName: vi.fn(),
    findCategoryByIdWithCount: vi.fn(),
    createCategory: vi.fn(),
    updateCategoryIfUnchanged: vi.fn(),
  },
}));

vi.mock("@/shared/config/env", () => ({
  env: { PAGE_SIZE: 30 },
}));

const updatedAt = new Date("2026-08-09T00:00:00.000Z");

function makeCategoryDetail(
  overrides: Partial<{
    id: number;
    name: string;
    createdAt: Date;
    createdBy: string | null;
    updatedAt: Date;
    updatedBy: string | null;
    _count: { masters: number };
  }> = {},
) {
  return {
    id: 12,
    name: "契約種別",
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    createdBy: "creator",
    updatedAt,
    updatedBy: "updater",
    _count: { masters: 3 },
    ...overrides,
  };
}

describe("master/service formatMasterCategoryCode", () => {
  describe("4桁未満のIDの場合", () => {
    it("左側を0で埋めた4桁のマスタ分類コードを返す", () => {
      expect(formatMasterCategoryCode(12)).toBe("0012");
    });
  });

  describe("4桁以上のIDの場合", () => {
    it("IDを切り詰めずそのまま返す", () => {
      expect(formatMasterCategoryCode(12345)).toBe("12345");
    });
  });
});

describe("master/service listCategories", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("2ページ目を取得する場合", () => {
    it("Repositoryへskipとtakeを渡し、一覧表示用の値とページ情報を返す", async () => {
      vi.mocked(masterRepository.listCategoriesAndCount).mockResolvedValue([
        [
          { id: 31, name: "契約種別", _count: { masters: 3 } },
          { id: 32, name: "請求区分", _count: { masters: 0 } },
        ],
        32,
      ]);

      const result = await masterService.listCategories(2, 30);

      expect(masterRepository.listCategoriesAndCount).toHaveBeenCalledWith(30, 30);
      expect(result).toEqual({
        items: [
          { id: 31, code: "0031", name: "契約種別", masterCount: 3 },
          { id: 32, code: "0032", name: "請求区分", masterCount: 0 },
        ],
        page: 2,
        pageSize: 30,
        total: 32,
        totalPages: 2,
      });
    });
  });

  describe("マスタ分類が登録されていない場合", () => {
    it("空の一覧と1ページ分のページ情報を返す", async () => {
      vi.mocked(masterRepository.listCategoriesAndCount).mockResolvedValue([[], 0]);

      await expect(masterService.listCategories(1, 30)).resolves.toEqual({
        items: [],
        page: 1,
        pageSize: 30,
        total: 0,
        totalPages: 1,
      });
    });
  });
});

describe("master/service createCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("同じ名称のマスタ分類が存在しない場合", () => {
    it("実行者を監査項目へ設定して登録し、一覧表示用の値を返す", async () => {
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue(null);
      vi.mocked(masterRepository.createCategory).mockResolvedValue({
        id: 12,
        name: "契約種別",
        createdAt: new Date("2026-08-09T00:00:00.000Z"),
        createdBy: "admin",
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
        updatedBy: "admin",
      });

      await expect(masterService.createCategory({ name: "契約種別" }, "admin")).resolves.toEqual({
        id: 12,
        code: "0012",
        name: "契約種別",
        masterCount: 0,
      });
      expect(masterRepository.createCategory).toHaveBeenCalledWith({
        name: "契約種別",
        createdBy: "admin",
        updatedBy: "admin",
      });
    });
  });

  describe("同じ名称のマスタ分類が既に存在する場合", () => {
    it("AppError(MASTER_CATEGORY_CONFLICT) を投げ、登録は行わない", async () => {
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue({ id: 1 });

      const result = masterService.createCategory({ name: "契約種別" }, "admin");
      await expect(result).rejects.toMatchObject({
        code: "MASTER_CATEGORY_CONFLICT",
        httpStatus: 409,
        userMessage: "同じ名前のマスタ分類が登録されています",
      } satisfies Partial<AppError>);
      expect(masterRepository.createCategory).not.toHaveBeenCalled();
    });
  });

  describe("事前確認後に一意制約違反が発生した場合", () => {
    it("AppError(MASTER_CATEGORY_CONFLICT) へ変換する", async () => {
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue(null);
      vi.mocked(masterRepository.createCategory).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["name"] },
        }),
      );

      await expect(
        masterService.createCategory({ name: "契約種別" }, "admin"),
      ).rejects.toMatchObject({
        code: "MASTER_CATEGORY_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });
});

describe("master/service findCategoryDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象のマスタ分類が存在する場合", () => {
    it("分類コード、配下件数および監査項目を含む詳細を返す", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(makeCategoryDetail());

      await expect(masterService.findCategoryDetail(12)).resolves.toEqual({
        id: 12,
        code: "0012",
        name: "契約種別",
        masterCount: 3,
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
        createdBy: "creator",
        updatedAt,
        updatedBy: "updater",
      });
    });
  });

  describe("対象のマスタ分類が存在しない場合", () => {
    it("nullを返す", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(null);
      await expect(masterService.findCategoryDetail(999)).resolves.toBeNull();
    });
  });
});

describe("master/service updateCategory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象が存在し、更新時点と名称が競合しない場合", () => {
    it("対象自身を重複判定から除外し、実行者を監査項目へ設定して更新する", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(makeCategoryDetail());
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.updateCategoryIfUnchanged).mockResolvedValue(true);

      await expect(
        masterService.updateCategory({ categoryId: 12, name: "契約種別", updatedAt }, "operator"),
      ).resolves.toBeUndefined();
      expect(masterRepository.updateCategoryIfUnchanged).toHaveBeenCalledWith(
        12,
        updatedAt,
        "契約種別",
        "operator",
      );
    });
  });

  describe("対象のマスタ分類が存在しない場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げ、重複確認も更新も行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(null);

      await expect(
        masterService.updateCategory({ categoryId: 999, name: "契約種別", updatedAt }, "admin"),
      ).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
        userMessage: "対象のマスタ分類が見つかりません",
      } satisfies Partial<AppError>);
      expect(masterRepository.findCategoryByName).not.toHaveBeenCalled();
      expect(masterRepository.updateCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("画面表示後にほかの利用者が更新していた場合", () => {
    it("AppError(MASTER_CONCURRENT_UPDATE) を投げ、重複確認も更新も行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(
        makeCategoryDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
      );

      await expect(
        masterService.updateCategory(
          { categoryId: 12, name: "新しい契約種別", updatedAt },
          "admin",
        ),
      ).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.findCategoryByName).not.toHaveBeenCalled();
      expect(masterRepository.updateCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("別のマスタ分類が更新後の名称を使用している場合", () => {
    it("AppError(MASTER_CATEGORY_CONFLICT) を投げ、更新は行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(makeCategoryDetail());
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue({ id: 13 });

      await expect(
        masterService.updateCategory({ categoryId: 12, name: "請求区分", updatedAt }, "admin"),
      ).rejects.toMatchObject({
        code: "MASTER_CATEGORY_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.updateCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("事前検査後から更新までの間にほかの利用者が更新した場合", () => {
    it("データベースの条件付き更新で検出してAppError(MASTER_CONCURRENT_UPDATE) を投げる", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount)
        .mockResolvedValueOnce(makeCategoryDetail())
        .mockResolvedValueOnce(
          makeCategoryDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
        );
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue(null);
      vi.mocked(masterRepository.updateCategoryIfUnchanged).mockResolvedValue(false);

      await expect(
        masterService.updateCategory(
          { categoryId: 12, name: "新しい契約種別", updatedAt },
          "admin",
        ),
      ).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前検査後から更新までの間に対象が削除された場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げる", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount)
        .mockResolvedValueOnce(makeCategoryDetail())
        .mockResolvedValueOnce(null);
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue(null);
      vi.mocked(masterRepository.updateCategoryIfUnchanged).mockResolvedValue(false);

      await expect(
        masterService.updateCategory(
          { categoryId: 12, name: "新しい契約種別", updatedAt },
          "admin",
        ),
      ).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前確認後に一意制約違反が発生した場合", () => {
    it("AppError(MASTER_CATEGORY_CONFLICT) へ変換する", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(makeCategoryDetail());
      vi.mocked(masterRepository.findCategoryByName).mockResolvedValue(null);
      vi.mocked(masterRepository.updateCategoryIfUnchanged).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["name"] },
        }),
      );

      await expect(
        masterService.updateCategory({ categoryId: 12, name: "請求区分", updatedAt }, "admin"),
      ).rejects.toMatchObject({
        code: "MASTER_CATEGORY_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });
});
