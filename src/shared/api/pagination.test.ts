/**
 * 対象: shared/api parseListQuery
 * 目的: 一覧URLのページ番号・ソート列・方向を安全に補正する仕様を担保する
 */
import { describe, expect, it, vi } from "vitest";
import { parseListQuery } from "@/shared/api/pagination";

vi.mock("@/shared/config/env", () => ({ env: { PAGE_SIZE: 30 } }));

const SORT_FIELDS = ["name", "kind"] as const;

describe("shared/api parseListQuery", () => {
  describe("有効なURLクエリの場合", () => {
    it("指定されたページ番号・ソート列・方向を返す", () => {
      expect(
        parseListQuery({ page: "3", sort: "kind", order: "desc" }, SORT_FIELDS, "name"),
      ).toEqual({
        page: 3,
        sort: "kind",
        order: "desc",
      });
    });
  });

  describe("URLクエリが未指定または不正な場合", () => {
    it("ページ番号・ソート列・方向を指定された初期値へ補正する", () => {
      expect(
        parseListQuery({ page: "0", sort: "unknown", order: "unknown" }, SORT_FIELDS, "name"),
      ).toEqual({ page: 1, sort: "name", order: "asc" });
    });
  });
});
