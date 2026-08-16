/**
 * 対象: master/jobs マスタ情報Excel取得の生成処理（worker側）
 * 目的: 状態遷移（受付済み→作成中→完了/失敗）・冪等性（二重処理の防止）・
 *       保存先やDBへ記録する内容が設計書 §40.5.3・§40.7.3 のとおりであることを担保する
 */
import { runMasterExcelExport } from "@/modules/master/jobs";
import { masterRepository } from "@/modules/master/repository";
import { storage } from "@/shared/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jobs.ts は service.ts の toCategoryDetail / toMasterDetail（詰め替えの純粋関数）を使う。
// service.ts はDBアクセス用の repository.ts（server-only）や、順番待ちの列（キュー）へ
// 接続する boss.ts、ページングの既定値を持つ env も読み込むため、テスト環境で読み込めるよう差し替える。
vi.mock("@/shared/config/env", () => ({ env: { PAGE_SIZE: 30 } }));
vi.mock("@/shared/jobs/boss", () => ({ getBoss: vi.fn() }));

vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    markExcelExportRunning: vi.fn(),
    listCategoriesForExport: vi.fn(),
    listMastersForExport: vi.fn(),
    markExcelExportReady: vi.fn(),
    markExcelExportFailed: vi.fn(),
  },
}));

vi.mock("@/shared/storage", () => ({
  storage: {
    upload: vi.fn(),
    download: vi.fn(),
    remove: vi.fn(),
    getSignedUrl: vi.fn(),
  },
}));

const EXPORT_ID = "export-1";
const BASE_TIME = new Date("2026-08-17T01:00:00.000Z"); // Asia/Tokyo で 10:00:00

const categoryRecord = {
  id: 3,
  name: "部門",
  createdAt: BASE_TIME,
  createdBy: "user1",
  updatedAt: BASE_TIME,
  updatedBy: "user1",
  _count: { masters: 1 },
};

const masterRecord = {
  id: 1,
  categoryId: 3,
  code: "A001",
  content: "総務部",
  createdAt: BASE_TIME,
  createdBy: "user1",
  updatedAt: BASE_TIME,
  updatedBy: "user1",
  category: { name: "部門" },
};

// わざと入れてある2分の待ちを実際に待たずに済ませる。
// 実時間で待つとテストが2分かかってしまうため、時間の進み方を操作する。
// setTimeout / Date だけを差し替える。setImmediate まで差し替えると、Excelファイルの組み立て
// （exceljs内部が使う圧縮処理）が止まってしまい、テストがいつまでも終わらなくなるため。
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  vi.setSystemTime(BASE_TIME);
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("runMasterExcelExport", () => {
  it("受付済みの依頼を処理し、状態を作成中→完了へ進める", async () => {
    vi.mocked(masterRepository.markExcelExportRunning).mockResolvedValue(true);
    vi.mocked(masterRepository.listCategoriesForExport).mockResolvedValue([categoryRecord]);
    vi.mocked(masterRepository.listMastersForExport).mockResolvedValue([masterRecord]);
    vi.mocked(masterRepository.markExcelExportReady).mockResolvedValue({} as never);

    const promise = runMasterExcelExport(EXPORT_ID);
    await vi.advanceTimersByTimeAsync(120_000);
    await promise;

    expect(masterRepository.markExcelExportRunning).toHaveBeenCalledWith(EXPORT_ID);
    expect(masterRepository.listCategoriesForExport).toHaveBeenCalledWith("code", "asc");
    expect(masterRepository.listMastersForExport).toHaveBeenCalledWith({}, "category", "asc");

    // ファイルの保存先に実行履歴の番号が含まれ、拡張子が.xlsxであること
    const [filePath, , contentType] = vi.mocked(storage.upload).mock.calls[0];
    expect(filePath).toMatch(/^master-excel-exports\/export-1\/master_info_\d{14}\.xlsx$/);
    expect(contentType).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );

    // 完了時に、件数・保存先・終了日時・7日後の期限を記録すること
    const readyData = vi.mocked(masterRepository.markExcelExportReady).mock.calls[0][1];
    expect(readyData.categoryRowCount).toBe(1);
    expect(readyData.masterRowCount).toBe(1);
    expect(readyData.filePath).toBe(filePath);
    expect(readyData.finishedAt.getTime()).toBe(BASE_TIME.getTime() + 120_000);
    expect(readyData.expiresAt.getTime()).toBe(
      readyData.finishedAt.getTime() + 7 * 24 * 60 * 60 * 1000,
    );
  });

  it("すでに処理済みの依頼が渡された場合、何もしない", async () => {
    vi.mocked(masterRepository.markExcelExportRunning).mockResolvedValue(false);

    await runMasterExcelExport(EXPORT_ID);

    expect(masterRepository.listCategoriesForExport).not.toHaveBeenCalled();
    expect(masterRepository.listMastersForExport).not.toHaveBeenCalled();
    expect(storage.upload).not.toHaveBeenCalled();
    expect(masterRepository.markExcelExportReady).not.toHaveBeenCalled();
    expect(masterRepository.markExcelExportFailed).not.toHaveBeenCalled();
  });

  it("途中で失敗した場合、状態を失敗にして例外を投げ直す", async () => {
    vi.mocked(masterRepository.markExcelExportRunning).mockResolvedValue(true);
    vi.mocked(masterRepository.listCategoriesForExport).mockResolvedValue([categoryRecord]);
    vi.mocked(masterRepository.listMastersForExport).mockResolvedValue([masterRecord]);
    vi.mocked(storage.upload).mockRejectedValue(new Error("保存先に書き込めなかった"));
    vi.mocked(masterRepository.markExcelExportFailed).mockResolvedValue({} as never);

    const promise = runMasterExcelExport(EXPORT_ID);
    await vi.advanceTimersByTimeAsync(120_000);

    await expect(promise).rejects.toThrow("保存先に書き込めなかった");
    expect(masterRepository.markExcelExportFailed).toHaveBeenCalledWith(
      EXPORT_ID,
      "MASTER_EXCEL_EXPORT_FAILED",
    );
  });
});
