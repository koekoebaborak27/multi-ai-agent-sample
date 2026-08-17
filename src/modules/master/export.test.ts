/**
 * 対象: master/export CSV生成処理
 * 目的: 出力列・書式（日時・null）・BOM・改行・ファイル名が設計書 §13.4 のとおりであることを担保する
 */
import {
  buildMasterCategoryExportCsv,
  buildMasterExportCsv,
  buildMasterExportFileName,
} from "@/modules/master/export";
import type { MasterCategoryDetail, MasterDetail } from "@/modules/master/types";
import { describe, expect, it, vi } from "vitest";

// export.ts は列コード変換のために service.ts の formatMasterCategoryCode を使う。
// service.ts はDBアクセス用の repository.ts（server-only）や、順番待ちの列（キュー）へ
// 接続する boss.ts も読み込むため、テスト環境（jsdom）で読み込めるよう差し替える。
vi.mock("@/modules/master/repository", () => ({ masterRepository: {} }));
vi.mock("@/modules/user/service", () => ({ userService: {} }));
vi.mock("@/shared/config/env", () => ({ env: { PAGE_SIZE: 30 } }));
vi.mock("@/shared/jobs/boss", () => ({ getBoss: vi.fn() }));

const createdAt = new Date("2026-08-12T00:30:00.000Z"); // Asia/Tokyo で 09:30:00
const updatedAt = new Date("2026-08-12T01:00:00.000Z"); // Asia/Tokyo で 10:00:00

describe("buildMasterExportCsv", () => {
  it("マスタの内容を9列・BOM付き・CRLF区切りのCSVにする", () => {
    const rows: MasterDetail[] = [
      {
        id: 1,
        categoryId: 3,
        categoryName: "部門",
        code: "A001",
        content: "総務部",
        createdAt,
        createdBy: "user1",
        updatedAt,
        updatedBy: null,
      },
    ];

    const csv = buildMasterExportCsv(rows);

    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "マスタ分類コード,マスタ分類名,マスタID,マスタコード,マスタ内容,登録日時,登録者,最終更新日時,最終更新者",
    );
    expect(lines[1]).toBe("0003,部門,1,A001,総務部,2026/08/12 09:30:00,user1,2026/08/12 10:00:00,");
  });

  it("値にカンマを含む場合だけ引用符で囲む", () => {
    const rows: MasterDetail[] = [
      {
        id: 1,
        categoryId: 1,
        categoryName: "部門",
        code: "A001",
        content: "総務部, 経理部",
        createdAt,
        createdBy: null,
        updatedAt,
        updatedBy: null,
      },
    ];

    const csv = buildMasterExportCsv(rows);

    expect(csv).toContain('"総務部, 経理部"');
  });

  it("行が無い場合もヘッダー行だけのCSVを返す", () => {
    const csv = buildMasterExportCsv([]);

    expect(csv.slice(1)).toBe(
      "マスタ分類コード,マスタ分類名,マスタID,マスタコード,マスタ内容,登録日時,登録者,最終更新日時,最終更新者\r\n",
    );
  });
});

describe("buildMasterCategoryExportCsv", () => {
  it("マスタ分類の内容を7列のCSVにする", () => {
    const rows: MasterCategoryDetail[] = [
      {
        id: 3,
        code: "0003",
        name: "部門",
        masterCount: 5,
        createdAt,
        createdBy: "user1",
        updatedAt,
        updatedBy: "user2",
      },
    ];

    const csv = buildMasterCategoryExportCsv(rows);

    const lines = csv.slice(1).split("\r\n");
    expect(lines[0]).toBe(
      "マスタ分類コード,マスタ分類名,登録マスタ件数,登録日時,登録者,最終更新日時,最終更新者",
    );
    expect(lines[1]).toBe("0003,部門,5,2026/08/12 09:30:00,user1,2026/08/12 10:00:00,user2");
  });
});

describe("buildMasterExportFileName", () => {
  it("マスタ一覧起点のファイル名を作る", () => {
    const fileName = buildMasterExportFileName("MASTER", new Date("2026-08-12T00:30:05.000Z"));

    expect(fileName).toBe("master_20260812093005.csv");
  });

  it("マスタ分類一覧起点のファイル名を作る", () => {
    const fileName = buildMasterExportFileName(
      "MASTER_CATEGORY",
      new Date("2026-08-12T00:30:05.000Z"),
    );

    expect(fileName).toBe("master_categories_20260812093005.csv");
  });
});
