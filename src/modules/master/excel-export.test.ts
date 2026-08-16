/**
 * 対象: master/excel-export Excel生成処理
 * 目的: シート構成・列・書式（日本時間・null空欄）・見た目（見出し行・縞模様・固定・オートフィルター）が
 *       設計書 §40.2 のとおりであることを担保する
 */
import ExcelJS from "exceljs";
import {
  buildMasterInfoExcel,
  buildMasterInfoExcelFileName,
} from "@/modules/master/excel-export";
import type { MasterCategoryDetail, MasterDetail } from "@/modules/master/types";
import { describe, expect, it, vi } from "vitest";

// excel-export.ts は列コード変換のために service.ts の formatMasterCategoryCode を使う。
// service.ts はDBアクセス用の repository.ts（server-only）や、順番待ちの列（キュー）へ
// 接続する boss.ts も読み込むため、テスト環境（jsdom）で読み込めるよう差し替える。
vi.mock("@/modules/master/repository", () => ({ masterRepository: {} }));
vi.mock("@/shared/config/env", () => ({ env: { PAGE_SIZE: 30 } }));
vi.mock("@/shared/jobs/boss", () => ({ getBoss: vi.fn() }));

const createdAt = new Date("2026-08-12T00:30:00.000Z"); // Asia/Tokyo で 09:30:00
const updatedAt = new Date("2026-08-12T01:00:00.000Z"); // Asia/Tokyo で 10:00:00
const generatedAt = new Date("2026-08-17T01:00:00.000Z"); // Asia/Tokyo で 10:00:00

const categories: MasterCategoryDetail[] = [
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

const masters: MasterDetail[] = [
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
  {
    id: 2,
    categoryId: 3,
    categoryName: "部門",
    code: "A002",
    content: "経理部",
    createdAt,
    createdBy: "user1",
    updatedAt,
    updatedBy: "user2",
  },
];

// 作った Buffer をもう一度 exceljs で読み込んで中身を確かめる。
// 内部の実装方法（どのAPIで書いたか）に依存せず、実際に出来上がったファイルの中身で検証できるため。
//
// exceljsの型定義は独自に`Buffer`という名前の型（実質ArrayBuffer相当）を宣言しており、
// Node.js本来のBufferとは型の見た目が食い違う（実行時には問題なく読み込める）。
// そのままでは型チェックが通らないため、一度 unknown を経由して型を合わせている。
async function readWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook;
}

describe("buildMasterInfoExcel", () => {
  it("シートを「マスタ分類」「マスタ」の順の2枚で作る", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["マスタ分類", "マスタ"]);
  });

  it("マスタ分類シートの見出し行が設計書どおりの7列である", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ分類")!;

    const headerValues = sheet.getRow(2).values as unknown[];
    expect(headerValues.slice(1)).toEqual([
      "マスタ分類コード",
      "マスタ分類名",
      "登録マスタ件数",
      "登録日時",
      "登録者",
      "最終更新日時",
      "最終更新者",
    ]);
  });

  it("マスタ分類の行を、分類コードを4桁ゼロ埋めして書き込む", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ分類")!;

    const row = sheet.getRow(3).values as unknown[];
    expect(row[1]).toBe("0003");
    expect(row[2]).toBe("部門");
    expect(row[3]).toBe(5);
  });

  it("マスタシートの見出し行が設計書どおりの9列である", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    const headerValues = sheet.getRow(2).values as unknown[];
    expect(headerValues.slice(1)).toEqual([
      "マスタ分類コード",
      "マスタ分類名",
      "マスタID",
      "マスタコード",
      "マスタ内容",
      "登録日時",
      "登録者",
      "最終更新日時",
      "最終更新者",
    ]);
  });

  it("マスタの行を、分類コード・マスタID・コード・内容の順に書き込む", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    const row = sheet.getRow(3).values as unknown[];
    expect(row.slice(1, 5)).toEqual(["0003", "部門", 1, "A001"]);
    expect(row[5]).toBe("総務部");
  });

  it("最終更新者がnullのとき、セルが空欄になる", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    // 1件目（id=1）は updatedBy が null のデータ
    const row = sheet.getRow(3).values as unknown[];
    expect(row[9]).toBeUndefined();
  });

  it("登録日時が日付の値として入り、日本時間の年月日時分秒になる", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ分類")!;

    const row = sheet.getRow(3).values as unknown[];
    const cellDate = row[4] as Date;
    expect(cellDate).toBeInstanceOf(Date);
    // toExcelDateTime で +9時間しているため、UTCの時刻としては日本時間の壁時計と同じ値になる
    expect(cellDate.getUTCFullYear()).toBe(2026);
    expect(cellDate.getUTCMonth()).toBe(7); // 0始まりなので8月は7
    expect(cellDate.getUTCDate()).toBe(12);
    expect(cellDate.getUTCHours()).toBe(9);
    expect(cellDate.getUTCMinutes()).toBe(30);
  });

  it("日時セルに表示形式 yyyy/mm/dd hh:mm:ss が付く", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ分類")!;

    const cell = sheet.getRow(3).getCell(4);
    expect(cell.numFmt).toBe("yyyy/mm/dd hh:mm:ss");
  });

  it("1行目にタイトル・出力日時・件数が入る", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    const titleRow = sheet.getRow(1);
    expect(titleRow.getCell(1).value).toBe("マスタ一覧");
    expect(titleRow.getCell(3).value).toBe("出力日時: 2026/08/17 10:00:00");
    expect(titleRow.getCell(5).value).toBe("件数: 2件");
  });

  it("見出し行が太字で背景色が付く", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    const headerCell = sheet.getRow(2).getCell(1);
    expect(headerCell.font?.bold).toBe(true);
    const fill = headerCell.fill as ExcelJS.FillPattern;
    expect(fill.fgColor?.argb).toBe("FF1E3A8A");
  });

  it("見出し行までが固定され、絞り込みの範囲が見出し行に設定される", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 2 });
    expect(sheet.autoFilter).toBeTruthy();
  });

  it("データ行が1行おきに薄い背景色になる", async () => {
    const buffer = await buildMasterInfoExcel({ categories, masters, generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ")!;

    // 1件目（3行目）は縞模様なし、2件目（4行目）は縞模様あり
    const plainFill = sheet.getRow(3).getCell(1).fill as ExcelJS.FillPattern;
    const stripedFill = sheet.getRow(4).getCell(1).fill as ExcelJS.FillPattern;
    expect(plainFill?.fgColor?.argb).toBeUndefined();
    expect(stripedFill.fgColor?.argb).toBe("FFEFF6FF");
  });

  it("行が0件のとき、タイトル行と見出し行だけのシートになる", async () => {
    const buffer = await buildMasterInfoExcel({ categories: [], masters: [], generatedAt });
    const workbook = await readWorkbook(buffer);
    const sheet = workbook.getWorksheet("マスタ分類")!;

    expect(sheet.getRow(1).getCell(5).value).toBe("件数: 0件");
    expect(sheet.getRow(3).getCell(1).value).toBeNull();
  });
});

describe("buildMasterInfoExcelFileName", () => {
  it("保存用ファイル名を作る", () => {
    const fileName = buildMasterInfoExcelFileName(new Date("2026-08-17T01:00:00.000Z"));

    expect(fileName).toBe("master_info_20260817100000.xlsx");
  });
});
