/**
 * 対象: party/validation 契約先の新規登録・更新フォームの入力チェック
 * 目的: 名称の必須・分類プルダウンの未選択時の扱いを担保する
 */
import { createPartySchema, updatePartySchema } from "@/modules/party/validation";
import { describe, expect, it } from "vitest";

describe("party/validation createPartySchema", () => {
  describe("正常系", () => {
    it("分類が選択されている場合、文字列をnumberへ変換する", () => {
      expect(
        createPartySchema.parse({ name: "サンプル契約先", companyTypeMasterId: "41" }),
      ).toEqual({ name: "サンプル契約先", companyTypeMasterId: 41, contactInfo: undefined });
    });
  });

  describe("分類が未選択の場合", () => {
    it("空文字列をundefinedへ変換する", () => {
      expect(createPartySchema.parse({ name: "サンプル契約先", companyTypeMasterId: "" })).toEqual({
        name: "サンプル契約先",
        companyTypeMasterId: undefined,
        contactInfo: undefined,
      });
    });

    it("項目自体が無い場合もundefinedへ変換する", () => {
      expect(createPartySchema.parse({ name: "サンプル契約先" })).toEqual({
        name: "サンプル契約先",
        companyTypeMasterId: undefined,
        contactInfo: undefined,
      });
    });
  });

  describe("分類の値が不正な場合", () => {
    it("エラーにはせずundefinedへ変換する", () => {
      expect(
        createPartySchema.parse({ name: "サンプル契約先", companyTypeMasterId: "abc" }),
      ).toEqual({ name: "サンプル契約先", companyTypeMasterId: undefined, contactInfo: undefined });
    });
  });

  describe("名称が空の場合", () => {
    it("必須エラーとして拒否する", () => {
      const result = createPartySchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("名称は必須です");
    });
  });

  describe("名称・連絡先が文字数上限を超える場合", () => {
    it("日本語の入力エラーとして拒否する", () => {
      const nameResult = createPartySchema.safeParse({ name: "あ".repeat(201) });
      const contactInfoResult = createPartySchema.safeParse({
        name: "サンプル契約先",
        contactInfo: "あ".repeat(501),
      });

      expect(nameResult.success).toBe(false);
      expect(contactInfoResult.success).toBe(false);
      if (!nameResult.success)
        expect(nameResult.error.issues[0]?.message).toBe("名称は200文字以内です");
      if (!contactInfoResult.success) {
        expect(contactInfoResult.error.issues[0]?.message).toBe("連絡先は500文字以内です");
      }
    });
  });
});

describe("party/validation updatePartySchema", () => {
  describe("正常系", () => {
    it("識別子・名称・分類を受け付ける", () => {
      const updatedAt = new Date("2026-08-19T00:00:00.000Z");
      expect(
        updatePartySchema.parse({
          id: "party-1",
          name: "サンプル契約先",
          companyTypeMasterId: "41",
          updatedAt,
        }),
      ).toEqual({
        id: "party-1",
        name: "サンプル契約先",
        companyTypeMasterId: 41,
        contactInfo: undefined,
        updatedAt,
      });
    });
  });

  describe("識別子が空の場合", () => {
    it("入力エラーとして拒否する", () => {
      expect(
        updatePartySchema.safeParse({
          id: "",
          name: "サンプル契約先",
          updatedAt: new Date(),
        }).success,
      ).toBe(false);
    });
  });

  describe("名称・連絡先が文字数上限を超える場合", () => {
    it("日本語の入力エラーとして拒否する", () => {
      const updatedAt = new Date("2026-08-19T00:00:00.000Z");
      const nameResult = updatePartySchema.safeParse({
        id: "party-1",
        name: "あ".repeat(201),
        updatedAt,
      });
      const contactInfoResult = updatePartySchema.safeParse({
        id: "party-1",
        name: "サンプル契約先",
        contactInfo: "あ".repeat(501),
        updatedAt,
      });

      expect(nameResult.success).toBe(false);
      expect(contactInfoResult.success).toBe(false);
      if (!nameResult.success)
        expect(nameResult.error.issues[0]?.message).toBe("名称は200文字以内です");
      if (!contactInfoResult.success) {
        expect(contactInfoResult.error.issues[0]?.message).toBe("連絡先は500文字以内です");
      }
    });
  });
});
