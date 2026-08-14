/**
 * 対象: master/service マスタ検索・登録とマスタ分類一覧・詳細・登録・更新
 * 目的: 検索条件の扱い、画面用の表示形式、コード・名前の重複防止、登録者などの記録、
 *       および他の利用者が先に更新していたときに上書きしないことを担保する
 */
import { masterRepository } from "@/modules/master/repository";
import { formatMasterCategoryCode, masterService } from "@/modules/master/service";
import { AppError } from "@/shared/errors/app-error";
import { getBoss } from "@/shared/jobs/boss";
import { storage } from "@/shared/storage";
import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

// データベースへの読み書きは差し替える。
// 実際のデータベースを用意しなくても、業務ルールの判定だけを取り出して確認できるようにするため。
vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    listMastersAndCount: vi.fn(),
    countMasters: vi.fn(),
    countCategories: vi.fn(),
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
    deleteMasterIfUnchanged: vi.fn(),
    deleteCategoryIfUnchanged: vi.fn(),
    createExport: vi.fn(),
    findExpiredExports: vi.fn(),
    deleteExports: vi.fn(),
    findExportById: vi.fn(),
  },
}));

// 環境変数の内容によって結果が変わらないよう、1ページの件数を固定する
vi.mock("@/shared/config/env", () => ({
  env: { PAGE_SIZE: 30 },
}));

// CSVの保存先（ストレージ）とジョブの順番待ち（pg-boss）は差し替える。
// ここで確認したいのは「何を呼んだか」だけで、実際のファイル操作やキュー接続は行わない。
vi.mock("@/shared/storage", () => ({
  storage: { remove: vi.fn(), download: vi.fn() },
}));
vi.mock("@/shared/jobs/boss", () => ({
  getBoss: vi.fn(),
}));

// 更新の試験で使う「画面を開いた時点の最終更新日時」。
// 他の利用者が先に更新していたかの判定に使うため、値を固定しておく。
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

describe("master/service deleteMaster", () => {
  const deleteInput = { masterId: 41, updatedAt };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象が存在し、画面表示時点と最終更新日時が一致する場合", () => {
    it("削除し、削除対象の分類名・コード・内容を返す", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(makeMasterDetail());
      vi.mocked(masterRepository.deleteMasterIfUnchanged).mockResolvedValue(true);

      await expect(masterService.deleteMaster(deleteInput)).resolves.toEqual({
        categoryName: "契約種別",
        code: "CON-01",
        content: "月額契約",
      });
      expect(masterRepository.deleteMasterIfUnchanged).toHaveBeenCalledWith(41, updatedAt);
    });
  });

  describe("対象のマスタが存在しない場合", () => {
    it("AppError(MASTER_NOT_FOUND) を投げ、削除は行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(null);

      await expect(masterService.deleteMaster(deleteInput)).rejects.toMatchObject({
        code: "MASTER_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(masterRepository.deleteMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("画面表示後にほかの利用者が更新していた場合", () => {
    it("AppError(MASTER_CONCURRENT_UPDATE) を投げ、削除は行わない", async () => {
      vi.mocked(masterRepository.findMasterById).mockResolvedValue(
        makeMasterDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
      );

      await expect(masterService.deleteMaster(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.deleteMasterIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("事前検査後から削除までの間にほかの利用者が更新した場合", () => {
    it("データベースの条件付き削除で検出してAppError(MASTER_CONCURRENT_UPDATE) を投げる", async () => {
      vi.mocked(masterRepository.findMasterById)
        .mockResolvedValueOnce(makeMasterDetail())
        .mockResolvedValueOnce(
          makeMasterDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
        );
      vi.mocked(masterRepository.deleteMasterIfUnchanged).mockResolvedValue(false);

      await expect(masterService.deleteMaster(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前検査後から削除までの間に対象がすでに削除されていた場合", () => {
    it("AppError(MASTER_NOT_FOUND) を投げる", async () => {
      vi.mocked(masterRepository.findMasterById)
        .mockResolvedValueOnce(makeMasterDetail())
        .mockResolvedValueOnce(null);
      vi.mocked(masterRepository.deleteMasterIfUnchanged).mockResolvedValue(false);

      await expect(masterService.deleteMaster(deleteInput)).rejects.toMatchObject({
        code: "MASTER_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });
});

describe("master/service deleteCategory", () => {
  const deleteInput = { categoryId: 12, updatedAt };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象が存在し、配下にマスタが無く、画面表示時点と最終更新日時が一致する場合", () => {
    it("削除し、削除対象の分類コード・名前を返す", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(
        makeCategoryDetail({ _count: { masters: 0 } }),
      );
      vi.mocked(masterRepository.deleteCategoryIfUnchanged).mockResolvedValue(true);

      await expect(masterService.deleteCategory(deleteInput)).resolves.toEqual({
        code: "0012",
        name: "契約種別",
      });
      expect(masterRepository.deleteCategoryIfUnchanged).toHaveBeenCalledWith(12, updatedAt);
    });
  });

  describe("配下にマスタが存在する場合", () => {
    it("AppError(MASTER_CATEGORY_HAS_MASTERS) を件数付きで投げ、削除は行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(
        makeCategoryDetail({ _count: { masters: 3 } }),
      );

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CATEGORY_HAS_MASTERS",
        httpStatus: 409,
        context: { id: 12, masterCount: 3 },
      } satisfies Partial<AppError>);
      expect(masterRepository.deleteCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("対象のマスタ分類が存在しない場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げ、削除は行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(null);

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(masterRepository.deleteCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("画面表示後にほかの利用者が更新していた場合", () => {
    it("AppError(MASTER_CONCURRENT_UPDATE) を投げ、削除は行わない", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount).mockResolvedValue(
        makeCategoryDetail({ updatedAt: new Date("2026-08-09T01:00:00.000Z") }),
      );

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(masterRepository.deleteCategoryIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("事前検査後から削除までの間にほかの利用者が更新した場合", () => {
    it("データベースの条件付き削除で検出してAppError(MASTER_CONCURRENT_UPDATE) を投げる", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount)
        .mockResolvedValueOnce(makeCategoryDetail({ _count: { masters: 0 } }))
        .mockResolvedValueOnce(
          makeCategoryDetail({
            _count: { masters: 0 },
            updatedAt: new Date("2026-08-09T01:00:00.000Z"),
          }),
        );
      vi.mocked(masterRepository.deleteCategoryIfUnchanged).mockResolvedValue(false);

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前検査後から削除までの間に対象がすでに削除されていた場合", () => {
    it("AppError(MASTER_CATEGORY_NOT_FOUND) を投げる", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount)
        .mockResolvedValueOnce(makeCategoryDetail({ _count: { masters: 0 } }))
        .mockResolvedValueOnce(null);
      vi.mocked(masterRepository.deleteCategoryIfUnchanged).mockResolvedValue(false);

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CATEGORY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
    });
  });

  describe("事前検査後から削除までの間にほかの利用者が配下へマスタを登録した場合", () => {
    it("外部キー制約違反をAppError(MASTER_CATEGORY_HAS_MASTERS) へ変換する", async () => {
      vi.mocked(masterRepository.findCategoryByIdWithCount)
        .mockResolvedValueOnce(makeCategoryDetail({ _count: { masters: 0 } }))
        .mockResolvedValueOnce(makeCategoryDetail({ _count: { masters: 1 } }));
      vi.mocked(masterRepository.deleteCategoryIfUnchanged).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Foreign key constraint failed", {
          code: "P2003",
          clientVersion: "6.19.3",
          meta: { field_name: "categoryId" },
        }),
      );

      await expect(masterService.deleteCategory(deleteInput)).rejects.toMatchObject({
        code: "MASTER_CATEGORY_HAS_MASTERS",
        httpStatus: 409,
        context: { id: 12, masterCount: 1 },
      } satisfies Partial<AppError>);
    });
  });
});

describe("master/service requestExport", () => {
  const boss = { start: vi.fn(), createQueue: vi.fn(), send: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getBoss).mockReturnValue(boss as never);
    vi.mocked(masterRepository.findExpiredExports).mockResolvedValue([]);
    vi.mocked(masterRepository.createExport).mockResolvedValue({
      id: "export1",
    } as never);
    vi.mocked(storage.remove).mockResolvedValue(undefined);
  });

  describe("対象件数が上限（10,000件）以下の場合", () => {
    it("MasterExportをQUEUEDで作成し、exportIdだけをキューへ送ってexportIdを返す", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(2);

      await expect(
        masterService.requestExport("MASTER", { categoryId: 3, keyword: "  con  " }, "user1"),
      ).resolves.toEqual({ exportId: "export1" });

      expect(masterRepository.countMasters).toHaveBeenCalledWith({
        categoryId: 3,
        keyword: "con",
      });
      expect(masterRepository.createExport).toHaveBeenCalledWith({
        target: "MASTER",
        categoryId: 3,
        keyword: "con",
        requestedBy: "user1",
      });
      expect(boss.createQueue).toHaveBeenCalledWith("master.export");
      expect(boss.send).toHaveBeenCalledWith("master.export", { exportId: "export1" });
    });
  });

  describe("対象件数が上限（10,000件）を超える場合", () => {
    it("MasterExportを作成せずAppError(MASTER_EXPORT_LIMIT_EXCEEDED) を投げる", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(10001);

      await expect(masterService.requestExport("MASTER", {}, "user1")).rejects.toMatchObject({
        code: "MASTER_EXPORT_LIMIT_EXCEEDED",
        httpStatus: 422,
        context: { count: 10001, max: 10000 },
      } satisfies Partial<AppError>);
      expect(masterRepository.createExport).not.toHaveBeenCalled();
      expect(boss.send).not.toHaveBeenCalled();
    });
  });

  describe("対象がマスタ分類（MASTER_CATEGORY）の場合", () => {
    it("検索条件を持たせず、分類の件数で上限を判定する", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(3);

      await masterService.requestExport("MASTER_CATEGORY", {}, "user1");

      expect(masterRepository.countCategories).toHaveBeenCalled();
      expect(masterRepository.countMasters).not.toHaveBeenCalled();
      expect(masterRepository.createExport).toHaveBeenCalledWith({
        target: "MASTER_CATEGORY",
        categoryId: undefined,
        keyword: undefined,
        requestedBy: "user1",
      });
    });
  });

  describe("保持期限を過ぎたMasterExportが残っている場合", () => {
    it("依頼のたびにストレージ上のファイルと行をまとめて削除する", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(1);
      vi.mocked(masterRepository.findExpiredExports).mockResolvedValue([
        { id: "old1", filePath: "master-export/old1.csv" },
        { id: "old2", filePath: null },
      ] as never);

      await masterService.requestExport("MASTER", {}, "user1");

      expect(storage.remove).toHaveBeenCalledTimes(1);
      expect(storage.remove).toHaveBeenCalledWith("master-export/old1.csv");
      expect(masterRepository.deleteExports).toHaveBeenCalledWith(["old1", "old2"]);
    });

    it("ストレージの削除に失敗しても行の削除は続ける", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(1);
      vi.mocked(masterRepository.findExpiredExports).mockResolvedValue([
        { id: "old1", filePath: "master-export/old1.csv" },
      ] as never);
      vi.mocked(storage.remove).mockRejectedValue(new Error("not found"));

      await expect(masterService.requestExport("MASTER", {}, "user1")).resolves.toBeDefined();
      expect(masterRepository.deleteExports).toHaveBeenCalledWith(["old1"]);
    });
  });
});

describe("master/service getExportStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("依頼した本人であれば状態を返す", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue({
      status: "RUNNING",
      errorCode: null,
      requestedBy: "user1",
    } as never);

    await expect(masterService.getExportStatus("exp1", "user1")).resolves.toEqual({
      status: "RUNNING",
      errorCode: undefined,
    });
  });

  it("依頼が存在しない場合はMASTER_EXPORT_NOT_FOUNDにする", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue(null);

    await expect(masterService.getExportStatus("exp1", "user1")).rejects.toMatchObject({
      code: "MASTER_EXPORT_NOT_FOUND",
    });
  });

  it("依頼した本人と異なる場合もMASTER_EXPORT_NOT_FOUNDにする（他人の依頼の存在を知らせないため）", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue({
      status: "READY",
      errorCode: null,
      requestedBy: "user2",
    } as never);

    await expect(masterService.getExportStatus("exp1", "user1")).rejects.toMatchObject({
      code: "MASTER_EXPORT_NOT_FOUND",
    });
  });
});

describe("master/service downloadExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(storage.remove).mockResolvedValue(undefined);
  });

  it("READYであればファイルを取得し、返した直後にファイルと行を削除する", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue({
      id: "exp1",
      status: "READY",
      filePath: "master-export/exp1.csv",
      fileName: "master_20260812120000.csv",
      requestedBy: "user1",
    } as never);
    vi.mocked(storage.download).mockResolvedValue(Buffer.from("csv-content"));

    const result = await masterService.downloadExport("exp1", "user1");

    expect(result).toEqual({
      fileName: "master_20260812120000.csv",
      data: Buffer.from("csv-content"),
    });
    expect(storage.remove).toHaveBeenCalledWith("master-export/exp1.csv");
    expect(masterRepository.deleteExports).toHaveBeenCalledWith(["exp1"]);
  });

  it("ストレージの削除に失敗しても応答は成功として返す", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue({
      id: "exp1",
      status: "READY",
      filePath: "master-export/exp1.csv",
      fileName: "master_20260812120000.csv",
      requestedBy: "user1",
    } as never);
    vi.mocked(storage.download).mockResolvedValue(Buffer.from("csv-content"));
    vi.mocked(storage.remove).mockRejectedValue(new Error("not found"));

    await expect(masterService.downloadExport("exp1", "user1")).resolves.toBeDefined();
    expect(masterRepository.deleteExports).toHaveBeenCalledWith(["exp1"]);
  });

  it("依頼が存在しない、または本人と異なる場合はMASTER_EXPORT_NOT_FOUNDにする", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue(null);

    await expect(masterService.downloadExport("exp1", "user1")).rejects.toMatchObject({
      code: "MASTER_EXPORT_NOT_FOUND",
    });
    expect(storage.download).not.toHaveBeenCalled();
  });

  it("READYでない場合はMASTER_EXPORT_NOT_READYにする", async () => {
    vi.mocked(masterRepository.findExportById).mockResolvedValue({
      id: "exp1",
      status: "RUNNING",
      filePath: null,
      fileName: null,
      requestedBy: "user1",
    } as never);

    await expect(masterService.downloadExport("exp1", "user1")).rejects.toMatchObject({
      code: "MASTER_EXPORT_NOT_READY",
    });
    expect(storage.download).not.toHaveBeenCalled();
  });
});
