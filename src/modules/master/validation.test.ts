/**
 * 対象: master/validation マスタ分類の登録・更新
 * 目的: 分類名の入力仕様と、更新対象ID・更新時点の変換を担保する
 */
import {
  createMasterCategorySchema,
  updateMasterCategorySchema,
} from "@/modules/master/validation";
import { describe, expect, it } from "vitest";

describe("master/validation createMasterCategorySchema", () => {
  describe("正常系", () => {
    it("前後の空白を除去したマスタ分類名を返す", () => {
      expect(createMasterCategorySchema.parse({ name: "  契約種別  " })).toEqual({
        name: "契約種別",
      });
    });

    it("Unicodeコードポイントで30文字のマスタ分類名を受け付ける", () => {
      const name = "😀".repeat(30);
      expect(createMasterCategorySchema.parse({ name })).toEqual({ name });
    });
  });

  describe("空白だけのマスタ分類名の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ name: "   " });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("マスタ分類名は必須です");
    });
  });

  describe("Unicodeコードポイントで31文字のマスタ分類名の場合", () => {
    it("文字数上限エラーとして拒否する", () => {
      const result = createMasterCategorySchema.safeParse({ name: "😀".repeat(31) });
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe("マスタ分類名は30文字以内です");
    });
  });
});

describe("master/validation updateMasterCategorySchema", () => {
  describe("正常系", () => {
    it("文字列の分類IDと更新時点をnumberとDateへ変換する", () => {
      expect(
        updateMasterCategorySchema.parse({
          categoryId: "12",
          name: "  契約種別  ",
          updatedAt: "2026-08-09T00:00:00.000Z",
        }),
      ).toEqual({
        categoryId: 12,
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
          name: "契約種別",
          updatedAt: "not-a-date",
        }).success,
      ).toBe(false);
    });
  });
});
