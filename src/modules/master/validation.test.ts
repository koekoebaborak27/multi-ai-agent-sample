/**
 * 対象: master/validation マスタ検索、マスタの登録およびマスタ分類の登録・更新
 * 目的: URL検索条件、戻り先URL、コード・内容・分類名の入力仕様、更新対象ID・更新時点の変換を担保する
 */
import {
  createMasterCategorySchema,
  createMasterSchema,
  deleteMasterCategorySchema,
  deleteMasterSchema,
  masterExcelExportListQuerySchema,
  masterSearchQuerySchema,
  parseMasterReturnTo,
  updateMasterCategorySchema,
  updateMasterSchema,
} from "@/modules/master/validation";
import { describe, expect, it } from "vitest";

describe("master/validation masterSearchQuerySchema", () => {
  describe("有効なURLクエリの場合", () => {
    it("分類IDとページ番号をnumberへ変換し、検索文字列の前後空白を除去する", () => {
      expect(
        masterSearchQuerySchema.parse({
          categoryId: "12",
          keyword: "  契約  ",
          page: "2",
          sort: "content",
          order: "desc",
        }),
      ).toEqual({ categoryId: 12, keyword: "契約", page: 2, sort: "content", order: "desc" });
    });

    it("すべての分類を選ぶクエリを明示的な検索条件として保持する", () => {
      expect(masterSearchQuerySchema.parse({ categoryId: "all" })).toEqual({
        categoryId: "all",
        keyword: undefined,
        page: 1,
        sort: "category",
        order: "asc",
      });
    });
  });

  describe("検索条件が空または不正な場合", () => {
    it("検索条件を未指定、ページ番号を1として扱う", () => {
      expect(
        masterSearchQuerySchema.parse({
          categoryId: "invalid",
          keyword: "   ",
          page: "0",
          sort: "invalid",
          order: "invalid",
        }),
      ).toEqual({
        categoryId: undefined,
        keyword: undefined,
        page: 1,
        sort: "category",
        order: "asc",
      });
    });
  });
});

describe("master/validation masterExcelExportListQuerySchema", () => {
  describe("有効なページ番号の場合", () => {
    it("ページ番号をnumberへ変換する", () => {
      expect(masterExcelExportListQuerySchema.parse({ page: "2" })).toEqual({ page: 2 });
    });
  });

  describe("ページ番号が未指定または不正な場合", () => {
    it("1ページ目として扱う", () => {
      expect(masterExcelExportListQuerySchema.parse({})).toEqual({ page: 1 });
      expect(masterExcelExportListQuerySchema.parse({ page: "0" })).toEqual({ page: 1 });
      expect(masterExcelExportListQuerySchema.parse({ page: "invalid" })).toEqual({ page: 1 });
    });
  });
});

describe("master/validation parseMasterReturnTo", () => {
  describe("マスタ検索一覧のURLが指定された場合", () => {
    it("検索条件を含むURLをそのまま戻り先とする", () => {
      expect(parseMasterReturnTo("/master?categoryId=12&page=2")).toBe(
        "/master?categoryId=12&page=2",
      );
      expect(parseMasterReturnTo("/master")).toBe("/master");
    });
  });

  describe("マスタ検索一覧以外が指定された場合", () => {
    it("マスタ検索一覧を戻り先とする", () => {
      expect(parseMasterReturnTo("https://example.com/master")).toBe("/master");
      expect(parseMasterReturnTo("//example.com")).toBe("/master");
      expect(parseMasterReturnTo("/masters")).toBe("/master");
      expect(parseMasterReturnTo("/admin/users")).toBe("/master");
      expect(parseMasterReturnTo(undefined)).toBe("/master");
      expect(parseMasterReturnTo("")).toBe("/master");
    });
  });
});

describe("master/validation createMasterSchema", () => {
  const valid = { categoryId: "12", code: "CON-01", content: "月額契約" };

  describe("正常系", () => {
    it("分類IDをnumberへ変換し、コードと内容の前後空白を除去する", () => {
      expect(
        createMasterSchema.parse({ categoryId: "12", code: "  CON-01  ", content: "  月額契約  " }),
      ).toEqual({ categoryId: 12, code: "CON-01", content: "月額契約" });
    });

    it("8文字のマスタコードとUnicodeコードポイントで30文字のマスタ内容を受け付ける", () => {
      const content = "😀".repeat(30);
      expect(createMasterSchema.parse({ ...valid, code: "A_1-B2C3", content })).toEqual({
        categoryId: 12,
        code: "A_1-B2C3",
        content,
      });
    });
  });

  describe("マスタ分類が未選択の場合", () => {
    it("選択を促すエラーとして拒否する", () => {
      const result = createMasterSchema.safeParse({ ...valid, categoryId: "" });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類を選択してください");
    });
  });

  describe("マスタコードが9文字の場合", () => {
    it("文字数上限エラーとして拒否する", () => {
      const result = createMasterSchema.safeParse({ ...valid, code: "ABCDEFGHI" });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタコードは8文字以内です");
    });
  });

  describe("マスタコードに許可されていない文字が含まれる場合", () => {
    it("英小文字、日本語、空白および記号を文字種エラーとして拒否する", () => {
      for (const code of ["con01", "契約", "CON 01", "CON@01"]) {
        const result = createMasterSchema.safeParse({ ...valid, code });
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues[0]?.message).toBe(
            "マスタコードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
          );
      }
    });
  });

  describe("マスタコードまたはマスタ内容が空白だけの場合", () => {
    it("必須エラーとして拒否する", () => {
      const emptyCode = createMasterSchema.safeParse({ ...valid, code: "   " });
      expect(emptyCode.success).toBe(false);
      if (!emptyCode.success)
        expect(emptyCode.error.issues[0]?.message).toBe("マスタコードは必須です");

      const emptyContent = createMasterSchema.safeParse({ ...valid, content: "   " });
      expect(emptyContent.success).toBe(false);
      if (!emptyContent.success)
        expect(emptyContent.error.issues[0]?.message).toBe("マスタ内容は必須です");
    });
  });

  describe("マスタ内容がUnicodeコードポイントで31文字の場合", () => {
    it("文字数上限エラーとして拒否する", () => {
      const result = createMasterSchema.safeParse({ ...valid, content: "😀".repeat(31) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ内容は30文字以内です");
    });
  });
});

describe("master/validation createMasterCategorySchema", () => {
  const valid = { code: "CONTRACT_TYPE", name: "契約種別" };

  describe("正常系", () => {
    it("前後の空白を除去したマスタ分類コードとマスタ分類名を返す", () => {
      expect(
        createMasterCategorySchema.parse({ code: "  CONTRACT_TYPE  ", name: "  契約種別  " }),
      ).toEqual({ code: "CONTRACT_TYPE", name: "契約種別" });
    });

    it("Unicodeコードポイントで30文字のマスタ分類名を受け付ける", () => {
      const name = "😀".repeat(30);
      expect(createMasterCategorySchema.parse({ ...valid, name })).toEqual({ ...valid, name });
    });

    it("50文字のマスタ分類コードを受け付ける", () => {
      const code = "A".repeat(50);
      expect(createMasterCategorySchema.parse({ ...valid, code })).toEqual({ ...valid, code });
    });
  });

  describe("空白だけのマスタ分類名の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ ...valid, name: "   " });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("マスタ分類名は必須です");
    });
  });

  describe("Unicodeコードポイントで31文字のマスタ分類名の場合", () => {
    it("文字数上限エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ ...valid, name: "😀".repeat(31) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類名は30文字以内です");
    });
  });

  describe("空白だけのマスタ分類コードの場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ ...valid, code: "   " });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類コードは必須です");
    });
  });

  describe("マスタ分類コードが51文字の場合", () => {
    it("文字数上限エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ ...valid, code: "A".repeat(51) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類コードは50文字以内です");
    });
  });

  describe("マスタ分類コードに許可されていない文字が含まれる場合", () => {
    it("英小文字、日本語、空白および記号を文字種エラーとして拒否する", () => {
      for (const code of ["contract_type", "契約分類", "CONTRACT TYPE", "CONTRACT@TYPE"]) {
        const result = createMasterCategorySchema.safeParse({ ...valid, code });
        expect(result.success).toBe(false);
        if (!result.success)
          expect(result.error.issues[0]?.message).toBe(
            "マスタ分類コードは英大文字、数字、ハイフン、アンダースコアだけで入力してください",
          );
      }
    });
  });
});

describe("master/validation updateMasterCategorySchema", () => {
  describe("正常系", () => {
    it("文字列の分類IDと更新時点をnumberとDateへ変換する", () => {
      expect(
        updateMasterCategorySchema.parse({
          categoryId: "12",
          code: "  CONTRACT_TYPE  ",
          name: "  契約種別  ",
          updatedAt: "2026-08-09T00:00:00.000Z",
        }),
      ).toEqual({
        categoryId: 12,
        code: "CONTRACT_TYPE",
        name: "契約種別",
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      });
    });
  });

  describe("分類IDまたは更新時点が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(
        updateMasterCategorySchema.safeParse({
          categoryId: "0",
          code: "CONTRACT_TYPE",
          name: "契約種別",
          updatedAt: "not-a-date",
        }).success,
      ).toBe(false);
    });
  });

  describe("マスタ分類コードが不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(
        updateMasterCategorySchema.safeParse({
          categoryId: "12",
          code: "contract_type",
          name: "契約種別",
          updatedAt: "2026-08-09T00:00:00.000Z",
        }).success,
      ).toBe(false);
    });
  });
});

describe("master/validation updateMasterSchema", () => {
  const valid = {
    masterId: "41",
    categoryId: "12",
    code: "CON-01",
    content: "月額契約",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };

  describe("正常系", () => {
    it("マスタID・分類IDと更新時点をnumberとDateへ変換し、コードと内容の前後空白を除去する", () => {
      expect(
        updateMasterSchema.parse({ ...valid, code: "  CON-01  ", content: "  月額契約  " }),
      ).toEqual({
        masterId: 41,
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      });
    });
  });

  describe("マスタIDが不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(updateMasterSchema.safeParse({ ...valid, masterId: "0" }).success).toBe(false);
    });
  });

  describe("マスタ分類が未選択の場合", () => {
    it("選択を促すエラーとして拒否する", () => {
      const result = updateMasterSchema.safeParse({ ...valid, categoryId: "" });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類を選択してください");
    });
  });

  describe("更新時点が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(updateMasterSchema.safeParse({ ...valid, updatedAt: "not-a-date" }).success).toBe(
        false,
      );
    });
  });
});

describe("master/validation deleteMasterSchema", () => {
  const valid = {
    masterId: "41",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };

  describe("正常系", () => {
    it("マスタIDをnumberへ、更新時点をDateへ変換する", () => {
      expect(deleteMasterSchema.parse(valid)).toEqual({
        masterId: 41,
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      });
    });
  });

  describe("マスタIDが不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(deleteMasterSchema.safeParse({ ...valid, masterId: "0" }).success).toBe(false);
    });
  });

  describe("更新時点が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(deleteMasterSchema.safeParse({ ...valid, updatedAt: "not-a-date" }).success).toBe(
        false,
      );
    });
  });
});

describe("master/validation deleteMasterCategorySchema", () => {
  const valid = {
    categoryId: "12",
    updatedAt: "2026-08-09T00:00:00.000Z",
  };

  describe("正常系", () => {
    it("マスタ分類IDをnumberへ、更新時点をDateへ変換する", () => {
      expect(deleteMasterCategorySchema.parse(valid)).toEqual({
        categoryId: 12,
        updatedAt: new Date("2026-08-09T00:00:00.000Z"),
      });
    });
  });

  describe("マスタ分類IDが不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(deleteMasterCategorySchema.safeParse({ ...valid, categoryId: "0" }).success).toBe(
        false,
      );
    });
  });

  describe("更新時点が不正な場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(
        deleteMasterCategorySchema.safeParse({ ...valid, updatedAt: "not-a-date" }).success,
      ).toBe(false);
    });
  });
});
