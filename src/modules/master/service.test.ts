/**
 * 対象: master/service マスタ検索・登録とマスタ分類一覧・詳細・登録・更新
 * 目的: 検索条件の扱い、画面用の表示形式、コード・名前の重複防止、登録者などの記録、
 *       および他の利用者が先に更新していたときに上書きしないことを担保する
 */
import { masterRepository } from "@/modules/master/repository";
import { formatMasterCategoryCode, masterService } from "@/modules/master/service";
import { MASTER_EXCEL_EXPORT_QUEUE } from "@/modules/master/types";
import { userService } from "@/modules/user/service";
import { AppError } from "@/shared/errors/app-error";
import { storage } from "@/shared/storage";
import type { MasterExcelExport } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// データベースへの読み書きは差し替える。
// 実際のデータベースを用意しなくても、業務ルールの判定だけを取り出して確認できるようにするため。
vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    listMastersAndCount: vi.fn(),
    countMasters: vi.fn(),
    countCategories: vi.fn(),
    listCategoryOptions: vi.fn(),
    listCategoriesAndCount: vi.fn(),
    listMastersForExport: vi.fn(),
    listCategoriesForExport: vi.fn(),
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
    createExcelExport: vi.fn(),
    listExcelExportsAndCount: vi.fn(),
    findExcelExportById: vi.fn(),
  },
}));

// 実行者名の解決は別モジュール（user）の責務のため、ここでは呼ばれ方だけを確認する。
vi.mock("@/modules/user/service", () => ({
  userService: {
    resolveDisplayNames: vi.fn(),
  },
}));

// ファイルの保存先（Supabase Storageまたはローカル）への読み書きは差し替える。
// ダウンロード処理が「保存先から正しいパスで読み出したか」だけを確認できるようにするため。
vi.mock("@/shared/storage", () => ({
  storage: {
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

// 環境変数の内容によって結果が変わらないよう、1ページの件数を固定する
vi.mock("@/shared/config/env", () => ({
  env: { PAGE_SIZE: 30 },
}));

// 順番待ちの列（キュー）への接続は差し替える。実際のデータベース接続をせず、
// start / createQueue / send がどう呼ばれたかだけを確認できるようにするため。
const bossMock = {
  start: vi.fn(),
  createQueue: vi.fn(),
  send: vi.fn(),
};
vi.mock("@/shared/jobs/boss", () => ({
  getBoss: vi.fn(() => bossMock),
}));

// 本番でだけ動く worker の起動要求も差し替える。ローカル判定や外部への通信を行わせず、
// 依頼を受け付けたときに呼ばれたかどうかだけを確認できるようにするため。
// vi.mock は vi.hoisted も含めてファイル先頭へ巻き上げられるため、
// 参照する変数は vi.hoisted で先に定義しておく必要がある。
const { invokeWorkerMock } = vi.hoisted(() => ({ invokeWorkerMock: vi.fn() }));
vi.mock("@/shared/jobs/invoke-worker", () => ({ invokeWorker: invokeWorkerMock }));

// 更新の試験で使う「画面を開いた時点の最終更新日時」。
// 他の利用者が先に更新していたかの判定に使うため、値を固定しておく。
const updatedAt = new Date("2026-08-09T00:00:00.000Z");

// マスタ情報Excel取得の実行履歴1件分のテストデータを作る。
// 一覧取得（listExcelExports）とダウンロード（getExcelExportDownload）の両方のテストから使うため、
// どちらのdescribeにも属さないモジュール直下に置いている。
function buildRow(overrides: Partial<MasterExcelExport>): MasterExcelExport {
  return {
    id: "export-1",
    status: "QUEUED",
    filePath: null,
    fileName: null,
    categoryRowCount: null,
    masterRowCount: null,
    errorCode: null,
    requestedBy: "admin",
    startedAt: null,
    finishedAt: null,
    expiresAt: null,
    createdAt: new Date("2026-08-17T00:00:00.000Z"),
    updatedAt: new Date("2026-08-17T00:00:00.000Z"),
    ...overrides,
  };
}

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

describe("master/service exportMasterCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象件数が上限（10,000件）以下の場合", () => {
    it("検索条件に一致するマスタをその場でCSVにして返す", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(1);
      vi.mocked(masterRepository.listMastersForExport).mockResolvedValue([makeMasterDetail()]);

      const result = await masterService.exportMasterCsv({ categoryId: 3, keyword: "  con  " });

      expect(masterRepository.countMasters).toHaveBeenCalledWith({
        categoryId: 3,
        keyword: "con",
      });
      expect(masterRepository.listMastersForExport).toHaveBeenCalledWith(
        { categoryId: 3, keyword: "con" },
        "category",
        "asc",
      );
      expect(result.fileName).toMatch(/^master_\d{14}\.csv$/);
      expect(result.data.toString("utf-8")).toContain("CON-01");
    });
  });

  describe("対象件数が上限（10,000件）を超える場合", () => {
    it("CSVを作らずAppError(MASTER_EXPORT_LIMIT_EXCEEDED) を投げる", async () => {
      vi.mocked(masterRepository.countMasters).mockResolvedValue(10001);

      await expect(masterService.exportMasterCsv({})).rejects.toMatchObject({
        code: "MASTER_EXPORT_LIMIT_EXCEEDED",
        httpStatus: 422,
        context: { count: 10001, max: 10000 },
      } satisfies Partial<AppError>);
      expect(masterRepository.listMastersForExport).not.toHaveBeenCalled();
    });
  });
});

describe("master/service exportCategoryCsv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象件数が上限（10,000件）以下の場合", () => {
    it("マスタ分類を全件その場でCSVにして返す", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(1);
      vi.mocked(masterRepository.listCategoriesForExport).mockResolvedValue([makeCategoryDetail()]);

      const result = await masterService.exportCategoryCsv();

      expect(masterRepository.listCategoriesForExport).toHaveBeenCalledWith("code", "asc");
      expect(result.fileName).toMatch(/^master_categories_\d{14}\.csv$/);
      expect(result.data.toString("utf-8")).toContain("契約種別");
    });
  });

  describe("対象件数が上限（10,000件）を超える場合", () => {
    it("CSVを作らずAppError(MASTER_EXPORT_LIMIT_EXCEEDED) を投げる", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(10001);

      await expect(masterService.exportCategoryCsv()).rejects.toMatchObject({
        code: "MASTER_EXPORT_LIMIT_EXCEEDED",
        httpStatus: 422,
        context: { count: 10001, max: 10000 },
      } satisfies Partial<AppError>);
      expect(masterRepository.listCategoriesForExport).not.toHaveBeenCalled();
    });
  });
});

describe("master/service requestExcelExport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("分類・マスタとも上限（10,000件）以下の場合", () => {
    it("実行履歴をQUEUEDで作り、順番待ちの列へexportIdだけを積み、workerを起動してexportIdを返す", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(2);
      vi.mocked(masterRepository.countMasters).mockResolvedValue(35);
      vi.mocked(masterRepository.createExcelExport).mockResolvedValue({
        id: "export-1",
        status: "QUEUED",
        filePath: null,
        fileName: null,
        categoryRowCount: null,
        masterRowCount: null,
        errorCode: null,
        requestedBy: "admin",
        startedAt: null,
        finishedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-08-17T00:00:00.000Z"),
        updatedAt: new Date("2026-08-17T00:00:00.000Z"),
      });

      const result = await masterService.requestExcelExport("admin");

      expect(masterRepository.createExcelExport).toHaveBeenCalledWith({ requestedBy: "admin" });
      expect(bossMock.start).toHaveBeenCalled();
      expect(bossMock.createQueue).toHaveBeenCalledWith(MASTER_EXCEL_EXPORT_QUEUE);
      expect(bossMock.send).toHaveBeenCalledWith(MASTER_EXCEL_EXPORT_QUEUE, {
        exportId: "export-1",
      });
      expect(invokeWorkerMock).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ exportId: "export-1" });
    });
  });

  describe("分類・マスタとも、ちょうど上限（10,000件）の場合", () => {
    it("上限を超えていないため正常に受け付ける", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(10000);
      vi.mocked(masterRepository.countMasters).mockResolvedValue(10000);
      vi.mocked(masterRepository.createExcelExport).mockResolvedValue({
        id: "export-2",
        status: "QUEUED",
        filePath: null,
        fileName: null,
        categoryRowCount: null,
        masterRowCount: null,
        errorCode: null,
        requestedBy: "admin",
        startedAt: null,
        finishedAt: null,
        expiresAt: null,
        createdAt: new Date("2026-08-17T00:00:00.000Z"),
        updatedAt: new Date("2026-08-17T00:00:00.000Z"),
      });

      const result = await masterService.requestExcelExport("admin");

      expect(result).toEqual({ exportId: "export-2" });
      expect(bossMock.send).toHaveBeenCalled();
    });
  });

  describe("マスタの件数が上限（10,000件）を超える場合", () => {
    it("実行履歴を作らずキューにも積まず、AppError(MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED) を投げる", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(2);
      vi.mocked(masterRepository.countMasters).mockResolvedValue(10001);

      await expect(masterService.requestExcelExport("admin")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED",
        httpStatus: 422,
        context: { categoryCount: 2, masterCount: 10001, max: 10000 },
      } satisfies Partial<AppError>);
      expect(masterRepository.createExcelExport).not.toHaveBeenCalled();
      expect(bossMock.send).not.toHaveBeenCalled();
    });
  });

  describe("マスタ分類の件数が上限（10,000件）を超える場合", () => {
    it("実行履歴を作らずキューにも積まず、AppError(MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED) を投げる", async () => {
      vi.mocked(masterRepository.countCategories).mockResolvedValue(10001);
      vi.mocked(masterRepository.countMasters).mockResolvedValue(35);

      await expect(masterService.requestExcelExport("admin")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED",
        httpStatus: 422,
        context: { categoryCount: 10001, masterCount: 35, max: 10000 },
      } satisfies Partial<AppError>);
      expect(masterRepository.createExcelExport).not.toHaveBeenCalled();
      expect(bossMock.send).not.toHaveBeenCalled();
    });
  });
});

describe("master/service listExcelExports", () => {
  // 「今」を固定するための基準時刻。期限切れかどうかの判定（expiresAtとの比較）に使う。
  const now = new Date("2026-08-18T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("一覧取得", () => {
    it("ページング計算をtoSkipTake/paginatedへ委譲し、全体件数からtotalPagesを求める", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [buildRow({ id: "export-1", requestedBy: "admin" })],
        41,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(
        new Map([["admin", "管理者太郎"]]),
      );

      const result = await masterService.listExcelExports(2, 30);

      expect(masterRepository.listExcelExportsAndCount).toHaveBeenCalledWith(30, 30);
      expect(result).toMatchObject({ page: 2, pageSize: 30, total: 41, totalPages: 2 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe("状態値ごとのラベル変換", () => {
    it.each([
      ["QUEUED", "受付済み"],
      ["RUNNING", "作成中"],
      ["FAILED", "失敗"],
    ] as const)("%sを「%s」に変換する", async (status, label) => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [buildRow({ status })],
        1,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(new Map([["admin", "admin"]]));

      const result = await masterService.listExcelExports(1, 30);

      expect(result.items[0]).toMatchObject({ status, statusLabel: label });
    });
  });

  describe("READYかつ保持期限内の場合", () => {
    it("「完了」ラベルとダウンロードリンクを持つ", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [
          buildRow({
            id: "export-9",
            status: "READY",
            expiresAt: new Date("2026-08-19T00:00:00.000Z"),
            categoryRowCount: 2,
            masterRowCount: 35,
          }),
        ],
        1,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(new Map([["admin", "admin"]]));

      const result = await masterService.listExcelExports(1, 30);

      expect(result.items[0]).toMatchObject({
        status: "READY",
        statusLabel: "完了",
        expired: false,
        categoryRowCount: 2,
        masterRowCount: 35,
        downloadHref: "/api/master/exports/export-9/download",
      });
    });
  });

  describe("READYだが保持期限（expiresAt）を過ぎている場合", () => {
    it("「期限切れ」ラベルとなり、ダウンロードリンクは出さない", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [
          buildRow({
            id: "export-9",
            status: "READY",
            expiresAt: new Date("2026-08-17T23:59:59.000Z"),
          }),
        ],
        1,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(new Map([["admin", "admin"]]));

      const result = await masterService.listExcelExports(1, 30);

      expect(result.items[0]).toMatchObject({
        status: "READY",
        statusLabel: "期限切れ",
        expired: true,
        downloadHref: null,
      });
    });
  });

  describe("FAILEDの場合", () => {
    it("利用者向けのエラーメッセージを持つ（内部のerrorCodeはそのまま出さない）", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [buildRow({ status: "FAILED", errorCode: "MASTER_EXCEL_EXPORT_FAILED" })],
        1,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(new Map([["admin", "admin"]]));

      const result = await masterService.listExcelExports(1, 30);

      expect(result.items[0].errorMessage).toBe(
        "Excelの作成に失敗しました。時間をおいてもう一度お試しください。",
      );
    });
  });

  describe("QUEUED/RUNNING/READY以外は件数・エラーメッセージを持たない", () => {
    it("QUEUEDのときcategoryRowCount/masterRowCount/errorMessageはnullのまま", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([[buildRow({})], 1]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(new Map([["admin", "admin"]]));

      const result = await masterService.listExcelExports(1, 30);

      expect(result.items[0]).toMatchObject({
        categoryRowCount: null,
        masterRowCount: null,
        errorMessage: null,
      });
    });
  });

  describe("実行者名の解決", () => {
    it("取得した行のrequestedByをまとめて渡し、解決した表示名を各行に反映する", async () => {
      vi.mocked(masterRepository.listExcelExportsAndCount).mockResolvedValue([
        [
          buildRow({ id: "export-1", requestedBy: "admin" }),
          buildRow({ id: "export-2", requestedBy: "admin" }),
        ],
        2,
      ]);
      vi.mocked(userService.resolveDisplayNames).mockResolvedValue(
        new Map([["admin", "管理者太郎"]]),
      );

      const result = await masterService.listExcelExports(1, 30);

      expect(userService.resolveDisplayNames).toHaveBeenCalledWith(["admin", "admin"]);
      expect(result.items[0].requestedByName).toBe("管理者太郎");
      expect(result.items[1].requestedByName).toBe("管理者太郎");
    });
  });
});

describe("master/service getExcelExportDownload", () => {
  // 「今」を固定するための基準時刻。listExcelExportsのテストと同じ値にそろえ、
  // 一覧表示とダウンロードで判定がずれていないことを確認しやすくする。
  const now = new Date("2026-08-18T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("完了していて保持期限内の履歴を指定した場合", () => {
    it("保存先のパスでファイルを取得し、記録されたファイル名と中身を返す", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({
          id: "export-9",
          status: "READY",
          filePath: "master-excel-exports/export-9/master_info_20260817103000.xlsx",
          fileName: "master_info_20260817103000.xlsx",
          expiresAt: new Date("2026-08-19T00:00:00.000Z"),
        }),
      );
      vi.mocked(storage.download).mockResolvedValue(Buffer.from("excel-body"));

      const result = await masterService.getExcelExportDownload("export-9");

      expect(masterRepository.findExcelExportById).toHaveBeenCalledWith("export-9");
      expect(storage.download).toHaveBeenCalledWith(
        "master-excel-exports/export-9/master_info_20260817103000.xlsx",
      );
      expect(result).toEqual({
        fileName: "master_info_20260817103000.xlsx",
        data: Buffer.from("excel-body"),
      });
    });
  });

  describe("保持期限がちょうど現在時刻と同じ場合", () => {
    it("期限内として扱い、ダウンロードできる", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({
          status: "READY",
          filePath: "master-excel-exports/export-1/master_info_20260817103000.xlsx",
          fileName: "master_info_20260817103000.xlsx",
          expiresAt: now,
        }),
      );
      vi.mocked(storage.download).mockResolvedValue(Buffer.from("excel-body"));

      await expect(masterService.getExcelExportDownload("export-1")).resolves.toMatchObject({
        fileName: "master_info_20260817103000.xlsx",
      });
    });
  });

  describe("保持期限が設定されていない場合", () => {
    it("期限切れとせずダウンロードできる", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({
          status: "READY",
          filePath: "master-excel-exports/export-1/master_info_20260817103000.xlsx",
          fileName: "master_info_20260817103000.xlsx",
          expiresAt: null,
        }),
      );
      vi.mocked(storage.download).mockResolvedValue(Buffer.from("excel-body"));

      await expect(masterService.getExcelExportDownload("export-1")).resolves.toMatchObject({
        fileName: "master_info_20260817103000.xlsx",
      });
    });
  });

  describe("指定された履歴が存在しない場合", () => {
    it("MASTER_EXCEL_EXPORT_NOT_FOUND(404)を投げ、ファイルの取得を試みない", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(null);

      await expect(masterService.getExcelExportDownload("does-not-exist")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });

  describe.each([["QUEUED"], ["RUNNING"], ["FAILED"]] as const)("状態が%sの場合", (status) => {
    it("MASTER_EXCEL_EXPORT_NOT_FOUND(404)を投げ、ファイルの取得を試みない", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(buildRow({ status }));

      await expect(masterService.getExcelExportDownload("export-1")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_NOT_FOUND",
        httpStatus: 404,
        context: expect.objectContaining({ status }),
      } satisfies Partial<AppError>);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });

  describe("保持期限を過ぎている場合", () => {
    it("MASTER_EXCEL_EXPORT_EXPIRED(410)を投げ、ファイルの取得を試みない", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({ status: "READY", expiresAt: new Date("2026-08-17T23:59:59.999Z") }),
      );

      await expect(masterService.getExcelExportDownload("export-1")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_EXPIRED",
        httpStatus: 410,
      } satisfies Partial<AppError>);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });

  describe("完了しているが保存先が記録されていない場合", () => {
    it("MASTER_EXCEL_EXPORT_NOT_FOUND(404)を投げ、ファイルの取得を試みない", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({
          status: "READY",
          expiresAt: new Date("2026-08-19T00:00:00.000Z"),
          filePath: null,
          fileName: null,
        }),
      );

      await expect(masterService.getExcelExportDownload("export-1")).rejects.toMatchObject({
        code: "MASTER_EXCEL_EXPORT_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(storage.download).not.toHaveBeenCalled();
    });
  });

  describe("保存先からの取得が失敗した場合", () => {
    it("受け止めずそのまま投げ直す", async () => {
      vi.mocked(masterRepository.findExcelExportById).mockResolvedValue(
        buildRow({
          status: "READY",
          expiresAt: new Date("2026-08-19T00:00:00.000Z"),
          filePath: "master-excel-exports/export-1/master_info_20260817103000.xlsx",
          fileName: "master_info_20260817103000.xlsx",
        }),
      );
      const storageError = new AppError(
        "STORAGE_DOWNLOAD_FAILED",
        502,
        "ファイルの取得に失敗しました",
      );
      vi.mocked(storage.download).mockRejectedValue(storageError);

      await expect(masterService.getExcelExportDownload("export-1")).rejects.toBe(storageError);
    });
  });
});
