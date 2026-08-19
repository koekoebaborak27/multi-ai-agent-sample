/**
 * 対象: contract/validation 契約の新規登録・更新フォームの入力チェック
 * 目的: 必須項目・状態の値・契約分類プルダウンの未選択時の扱いを担保する
 */
import { createContractSchema, updateContractSchema } from "@/modules/contract/validation";
import { describe, expect, it } from "vitest";

describe("contract/validation createContractSchema", () => {
  const valid = { partyId: "party-1", title: "サンプル契約" };

  describe("正常系", () => {
    it("契約分類が選択されている場合、文字列をnumberへ変換する", () => {
      expect(createContractSchema.parse({ ...valid, categoryMasterId: "51" })).toMatchObject({
        partyId: "party-1",
        title: "サンプル契約",
        status: "DRAFT",
        categoryMasterId: 51,
      });
    });
  });

  describe("契約分類が未選択の場合", () => {
    it("空文字列をundefinedへ変換する", () => {
      expect(createContractSchema.parse({ ...valid, categoryMasterId: "" })).toMatchObject({
        categoryMasterId: undefined,
      });
    });

    it("項目自体が無い場合もundefinedになる", () => {
      expect(createContractSchema.parse(valid).categoryMasterId).toBeUndefined();
    });
  });

  describe("契約分類の値が不正な場合", () => {
    it("エラーにはせずundefinedへ変換する", () => {
      expect(createContractSchema.parse({ ...valid, categoryMasterId: "abc" })).toMatchObject({
        categoryMasterId: undefined,
      });
    });
  });

  describe("契約先が未選択の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createContractSchema.safeParse({ ...valid, partyId: "" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("契約先は必須です");
    });
  });

  describe("契約名が空の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createContractSchema.safeParse({ ...valid, title: "" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("契約名は必須です");
    });
  });
});

describe("contract/validation updateContractSchema", () => {
  const updatedAt = new Date("2026-08-19T00:00:00.000Z");
  const valid = { id: "contract-1", title: "サンプル契約", status: "ACTIVE", updatedAt };

  describe("正常系", () => {
    it("識別子・契約名・状態・契約分類を受け付ける", () => {
      expect(updateContractSchema.parse({ ...valid, categoryMasterId: "52" })).toMatchObject({
        id: "contract-1",
        title: "サンプル契約",
        status: "ACTIVE",
        categoryMasterId: 52,
        updatedAt,
      });
    });
  });

  describe("状態が定義外の値の場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(updateContractSchema.safeParse({ ...valid, status: "UNKNOWN" }).success).toBe(false);
    });
  });
});
