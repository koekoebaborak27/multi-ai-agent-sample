/**
 * 対象: master/service マスタ検索・登録とマスタ分類一覧・詳細・登録・更新
 * 目的: 検索条件、表示形式、重複防止、監査項目および楽観的排他制御を担保する
 */
import { masterRepository } from "@/modules/master/repository";
import { formatMasterCategoryCode, masterService } from "@/modules/master/service";
import { AppError } from "@/shared/errors/app-error";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    listMastersAndCount: vi.fn(),
    listCategoryOptions: vi.fn(),
    listCategoriesAndCount: vi.fn(),
    findMasterById: vi.fn(),
    findMasterByCategoryAndCode: vi.fn(),
    createMaster: vi.fn(),
    findCategoryById: vi.fn(),
    findCategoryByName: vi.fn(),
    findCategoryByIdWithCount: vi.fn(),
    createCategory: vi.fn(),
    updateCategoryIfUnchanged: vi.fn(),
    updateMasterIfUnchanged: vi.fn(),
  },
}));

vi.mock("@/shared/config/env", () => ({
  env: { PAGE_SIZE: 30 },
}));

const updatedAt = new Date("2026-08-09T00:00:00.000Z");

describe("master/service listMasters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("分類と前後に空白がある検索文字列を指定した場合", () => {
    it("検索文字列を正規化し、Repositoryへ検索条件とページング位置を渡す", async () => {
      vi.mocked(masterRepository.listMastersAndCount).mockResolvedValue([
        [
          {
            id: 41,
            categoryId: 3,
            code: "CON00001",
            content: "月額契約",
            category: { name: "契約種別" },
          },
        ],
        31,
      ]);

      await expect(
        masterService.listMasters({ categoryId: 3, keyword: "  con  " }, 2, 30, "code", "desc"),
      ).resolves.toEqual({
        items: [
          {
            id: 41,
            categoryId: 3,
            categoryName: "契約種別",
            code: "CON00001",
            content: "月額契約",
          },
        ],
        page: 2,
        pageSize: 30,
        total: 31,
        totalPages: 2,
      });
      expect(masterRepository.listMastersAndCount).toHaveBeenCalledWith(
        { categoryId: 3, keyword: "con" },
        30,
        30,
        "code",
        "desc",
      );
    });
  });

  describe("検索文字列が空白だけの場合", () => {
    it("検索文字列を未指定として全件検索する", async () => {
      vi.mocked(masterRepository.listMastersAndCount).mockResolvedValue([[], 0]);

      await masterService.listMasters({ keyword: "   " }, 1, 30);

      expect(masterRepository.listMastersAndCount).toHaveBeenCalledWith(
        { categoryId: undefined, keyword: undefined },
        0,
        30,
        "category",
        "asc",
      );
    });
  });
});

describe("master/service createMaster", () => {
  const input = { categoryId: 12, code: "CON-01", content: "月額契約" };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("分類が存在し、同じ分類内にコードが無い場合", () => {
    it("実行者を監査項目へ設定して登録し、一覧表示用の値を返す", async () => {
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.createMaster).mockResolvedValue({
        id: 41,
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        category: { name: "契約種別" },
      });

      await expect(masterService.createMaster(input, "admin")).resolves.toEqual({
        id: 41,
        categoryId: 12,
        categoryName: "契約種別",
        code: "CON-01",
        content: "月額契約",
      });
      expect(masterRepository.createMaster).toHaveBeenCalledWith({
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        createdBy: "admin",
        updatedBy: "admin",
      });
    });
  });

  describe("選択されたマスタ分類が存在しない場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げ、重複確認も登録も行わない", async () => {
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue(null);

      await expect(masterService.createMaster(input, "admin")).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
        userMessage: "対象のマスタ分類が見つかりません",
      } satisfies Partial<AppError>);
      expect(masterRepository.findMasterByCategoryAndCode).not.toHaveBeenCalled();
      expect(masterRepository.createMaster).not.toHaveBeenCalled();
    });
  });

  describe("同じマスタ分類に同じマスタコードが登録済みの場合", () => {
    it("AppError(MASTER_CODE_CONFLICT) を投げ、登録は行わない", async () => {
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue({ id: 41 });

      await expect(masterService.createMaster(input, "admin")).rejects.toMatchObject({
        code: "MASTER_CODE_CONFLICT",
        httpStatus: 409,
        userMessage: "同じマスタ分類に同じマスタコードが登録されています",
      } satisfies Partial<AppError>);
      expect(masterRepository.createMaster).not.toHaveBeenCalled();
    });
  });

  describe("事前確認後に複合一意制約違反が発生した場合", () => {
    it("AppError(MASTER_CODE_CONFLICT) へ変換する", async () => {
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.createMaster).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["categoryId", "code"] },
        }),
      );

      await expect(masterService.createMaster(input, "admin")).rejects.toMatchObject({
        code: "MASTER_CODE_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前確認後に選択された分類が削除された場合", () => {
    it("外部キー制約違反をAppError(MASTER_CATEGORY_NOT_FOUND) へ変換する", async () => {
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.createMaster).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
          code: "P2003",
          clientVersion: "6.19.3",
          meta: { field_name: "categoryId" },
        }),
      );

      await expect(masterService.createMaster(input, "admin")).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });
});

describe("master/service assertMasterCodeAvailable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("同じコードを持つのが対象マスタ自身だけの場合", () => {
    it("重複と判定しない", async () => {
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue({ id: 41 });

      await expect(
        masterService.assertMasterCodeAvailable(12, "CON-01", 41),
      ).resolves.toBeUndefined();
    });
  });

  describe("別のマスタが同じコードを持つ場合", () => {
    it("AppError(MASTER_CODE_CONFLICT) を投げる", async () => {
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue({ id: 42 });

      await expect(masterService.assertMasterCodeAvailable(12, "CON-01", 41)).rejects.toMatchObject(
        {
          code: "MASTER_CODE_CONFLICT",
          httpStatus: 409,
        } satisfies Partial<AppError>,
      );
    });
  });
});

describe("master/service listCategoryOptions", () => {
  describe("マスタ分類が登録されている場合", () => {
    it("分類コードを付けた検索選択肢を返す", async () => {
      vi.mocked(masterRepository.listCategoryOptions).mockResolvedValue([
        { id: 3, name: "契約種別" },
        { id: 12, name: "支払方法" },
      ]);

      await expect(masterService.listCategoryOptions()).resolves.toEqual([
        { id: 3, code: "0003", name: "契約種別" },
        { id: 12, code: "0012", name: "支払方法" },
      ]);
    });
  });
});

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

function makeMasterDetail(
  overrides: Partial<{
    id: number;
    categoryId: number;
    code: string;
    content: string;
    createdAt: Date;
    createdBy: string | null;
    updatedAt: Date;
    updatedBy: string | null;
    category: { name: string };
  }> = {},
) {
  return {
    id: 41,
    categoryId: 12,
    code: "CON-01",
    content: "月額契約",
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    createdBy: "creator",
    updatedAt,
    updatedBy: "updater",
    category: { name: "契約種別" },
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

      const result = await masterService.listCategories(2, 30, "name", "desc");

      expect(masterRepository.listCategoriesAndCount).toHaveBeenCalledWith(30, 30, "name", "desc");
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

describe("master/service findMasterDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象のマスタが存在する場合", () => {
    it("マスタ分類名と監査項目を含む詳細を返す", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue({
        id: 41,
        categoryId: 3,
        code: "CON00001",
        content: "月額契約",
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
        createdBy: "creator",
        updatedAt,
        updatedBy: "updater",
        category: { name: "契約種別" },
      });

      await expect(masterService.findMasterDetail(41)).resolves.toEqual({
        id: 41,
        categoryId: 3,
        categoryName: "契約種別",
        code: "CON00001",
        content: "月額契約",
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
        createdBy: "creator",
        updatedAt,
        updatedBy: "updater",
      });
    });
  });

  describe("登録者と最終更新者が記録されていない場合", () => {
    it("nullのまま返し、表示側の判断に委ねる", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue({
        id: 41,
        categoryId: 3,
        code: "CON00001",
        content: "月額契約",
        createdAt: new Date("2026-08-08T00:00:00.000Z"),
        createdBy: null,
        updatedAt,
        updatedBy: null,
        category: { name: "契約種別" },
      });

      await expect(masterService.findMasterDetail(41)).resolves.toMatchObject({
        createdBy: null,
        updatedBy: null,
      });
    });
  });

  describe("対象のマスタが存在しない場合", () => {
    it("nullを返す", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(null);
      await expect(masterService.findMasterDetail(999)).resolves.toBeNull();
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

describe("master/service updateMaster", () => {
  const updateInput = {
    masterId: 41,
    categoryId: 12,
    code: "CON-02",
    content: "年額契約",
    updatedAt,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象が存在し、更新時点と重複が競合しない場合", () => {
    it("対象自身を重複判定から除外し、実行者を監査項目へ設定して更新する", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.updateMasterIfUnchanged).mockResolvedValue(true);

      await expect(masterService.updateMaster(updateInput, "operator")).resolves.toBeUndefined();
      expect(masterRepository.updateMasterIfUnchanged).toHaveBeenCalledWith(41, updatedAt, {
        categoryId: 12,
        code: "CON-02",
        content: "年額契約",
        updatedBy: "operator",
      });
    });
  });

  describe("対象のマスタが存在しない場合", () => {
    it("AppError(MASTER_NOT_FOUND) を投げ、以降の検証も更新も行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(null);

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_NOT_FOUND",
        httpStatus: 404,
        userMessage: "対象のマスタが見つかりません",
      } satisfies Partial<AppError>);
      expect(masterRepository.findCategoryById).not.toHaveBeenCalled();
      expect(masterRepository.updateMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("画面表示後にほかの利用者が更新していた場合", () => {
    it("AppError(MASTER_CONCURRENT_UPDATE) を投げ、以降の検証も更新も行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(
        makeMasterDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
      );

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.findCategoryById).not.toHaveBeenCalled();
      expect(masterRepository.updateMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("変更後のマスタ分類が存在しない場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げ、コード重複確認も更新も行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue(null);

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(masterRepository.findMasterByCategoryAndCode).not.toHaveBeenCalled();
      expect(masterRepository.updateMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("変更後のマスタ分類に同じコードの別マスタが存在する場合", () => {
    it("AppError(MASTER_CODE_CONFLICT) を投げ、更新は行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue({ id: 99 });

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CODE_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.updateMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("事前検査後から更新までの間にほかの利用者が更新した場合", () => {
    it("データベースの条件付き更新で検出してAppError(MASTER_CONCURRENT_UPDATE) を投げる", async () => {
      vi.mocked(masterRepository.findMasterById)
        .mockResolvedValueOnce(makeMasterDetail())
        .mockResolvedValueOnce(
          makeMasterDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
        );
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.updateMasterIfUnchanged).mockResolvedValue(false);

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前検査後から更新までの間に対象が削除された場合", () => {
    it("AppError(MASTER_NOT_FOUND) を投げる", async () => {
      vi.mocked(masterRepository.findMasterById)
        .mockResolvedValueOnce(makeMasterDetail())
        .mockResolvedValueOnce(null);
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.updateMasterIfUnchanged).mockResolvedValue(false);

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前確認後に複合一意制約違反が発生した場合", () => {
    it("AppError(MASTER_CODE_CONFLICT) へ変換する", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.updateMasterIfUnchanged).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "6.19.3",
          meta: { target: ["categoryId", "code"] },
        }),
      );

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CODE_CONFLICT",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前確認後に変更後の分類が削除された場合", () => {
    it("外部キー制約違反をAppError(MASTER_CATEGORY_NOT_FOUND) へ変換する", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.findCategoryById).mockResolvedValue({ id: 12 });
      vi.mocked(masterRepository.findMasterByCategoryAndCode).mockResolvedValue(null);
      vi.mocked(masterRepository.updateMasterIfUnchanged).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
          code: "P2003",
          clientVersion: "6.19.3",
          meta: { field_name: "categoryId" },
        }),
      );

      await expect(masterService.updateMaster(updateInput, "admin")).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });
});
