/**
 * 対象: master/jobs マスタ情報Excel取得の生成処理（worker側）
 * 目的: 状態遷移（受付済み→作成中→完了/失敗）・冪等性（二重処理の防止）・
 *       保存先やDBへ記録する内容が設計書 §40.5.3・§40.7.3 のとおりであることと、
 *       保持期限切れファイルの掃除が本処理より先に走り、失敗しても本処理を止めないこと（§40.9）を担保する
 */
import { runMasterExcelExport } from "@/modules/master/jobs";
import { masterRepository } from "@/modules/master/repository";
import { storage } from "@/shared/storage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jobs.ts は service.ts の toCategoryDetail / toMasterDetail（詰め替えの純粋関数）を使う。
// service.ts はDBアクセス用の repository.ts（server-only）や、順番待ちの列（キュー）へ
// 接続する boss.ts、ページングの既定値を持つ env も読み込むため、テスト環境で読み込めるよう差し替える。
// 掃除処理（withJob）は記録係（logger）まで読み込むため、これも差し替える。
vi.mock("@/shared/config/env", () => ({ env: { PAGE_SIZE: 30 } }));
vi.mock("@/shared/jobs/boss", () => ({ getBoss: vi.fn() }));
vi.mock("@/shared/jobs/invoke-worker", () => ({ invokeWorker: vi.fn() }));
vi.mock("@/modules/user/service", () => ({ userService: {} }));

const { childLoggerMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return { childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })) };
});
vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/modules/master/repository", () => ({
  masterRepository: {
    markExcelExportRunning: vi.fn(),
    listCategoriesForExport: vi.fn(),
    listMastersForExport: vi.fn(),
    markExcelExportReady: vi.fn(),
    markExcelExportFailed: vi.fn(),
    listExpiredExcelExportFiles: vi.fn(),
    markExcelExportFileRemoved: vi.fn(),
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
  code: "0003",
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
  category: { code: "0003", name: "部門" },
};

// 生成日時（ファイル名・finishedAt・expiresAt）を決まった値で確かめられるよう、時計だけを固定する。
// 時間の進み方（setTimeoutなど）は本物のままにする。
beforeEach(() => {
  vi.setSystemTime(BASE_TIME);
  // 掃除処理は本処理の前に必ず呼ばれるため、既定では「対象なし」にしておく。
  // 個別のテストでは、必要に応じてこの既定値を上書きする。
  vi.mocked(masterRepository.listExpiredExcelExportFiles).mockResolvedValue([]);
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

    await runMasterExcelExport(EXPORT_ID);

    expect(masterRepository.markExcelExportRunning).toHaveBeenCalledWith(EXPORT_ID);
    expect(masterRepository.listCategoriesForExport).toHaveBeenCalledWith("code", "asc");
    expect(masterRepository.listMastersForExport).toHaveBeenCalledWith({}, "category", "asc");

    // ファイルの保存先に実行履歴の番号が含まれ、拡張子が.xlsxであること
    const [filePath, , contentType] = vi.mocked(storage.upload).mock.calls[0];
    expect(filePath).toMatch(/^master-excel-exports\/export-1\/master_info_\d{14}\.xlsx$/);
    expect(contentType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    // 完了時に、件数・保存先・終了日時・7日後の期限を記録すること
    const readyData = vi.mocked(masterRepository.markExcelExportReady).mock.calls[0][1];
    expect(readyData.categoryRowCount).toBe(1);
    expect(readyData.masterRowCount).toBe(1);
    expect(readyData.filePath).toBe(filePath);
    expect(readyData.finishedAt.getTime()).toBe(BASE_TIME.getTime());
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
    // 二重配信された依頼では、掃除も含めて何もしない
    expect(masterRepository.listExpiredExcelExportFiles).not.toHaveBeenCalled();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it("途中で失敗した場合、状態を失敗にして例外を投げ直す", async () => {
    vi.mocked(masterRepository.markExcelExportRunning).mockResolvedValue(true);
    vi.mocked(masterRepository.listCategoriesForExport).mockResolvedValue([categoryRecord]);
    vi.mocked(masterRepository.listMastersForExport).mockResolvedValue([masterRecord]);
    vi.mocked(storage.upload).mockRejectedValue(new Error("保存先に書き込めなかった"));
    vi.mocked(masterRepository.markExcelExportFailed).mockResolvedValue({} as never);

    await expect(runMasterExcelExport(EXPORT_ID)).rejects.toThrow("保存先に書き込めなかった");
    expect(masterRepository.markExcelExportFailed).toHaveBeenCalledWith(
      EXPORT_ID,
      "MASTER_EXCEL_EXPORT_FAILED",
    );
  });
});

describe("期限切れファイルの掃除", () => {
  const expiredFileA = { id: "expired-1", filePath: "master-excel-exports/expired-1/file.xlsx" };
  const expiredFileB = { id: "expired-2", filePath: "master-excel-exports/expired-2/file.xlsx" };

  // 掃除以外の、本処理（Excel生成）を毎回成功させるための共通の下ごしらえ。
  // storage.upload は直前の「途中で失敗した場合」テストで失敗するよう差し替えられており、
  // vi.clearAllMocks() では呼び出し履歴しかリセットされない（差し替えた戻り値は残る）ため、
  // ここで明示的に成功する値へ戻す。
  function setUpSuccessfulGeneration() {
    vi.mocked(masterRepository.markExcelExportRunning).mockResolvedValue(true);
    vi.mocked(masterRepository.listCategoriesForExport).mockResolvedValue([categoryRecord]);
    vi.mocked(masterRepository.listMastersForExport).mockResolvedValue([masterRecord]);
    vi.mocked(masterRepository.markExcelExportReady).mockResolvedValue({} as never);
    vi.mocked(storage.upload).mockResolvedValue(undefined);
  }

  it("期限切れの対象が無い場合、削除処理を呼ばず本処理を完了する", async () => {
    setUpSuccessfulGeneration();
    // beforeEachの既定どおり listExpiredExcelExportFiles は空配列を返す

    await runMasterExcelExport(EXPORT_ID);

    expect(masterRepository.listExpiredExcelExportFiles).toHaveBeenCalledWith(BASE_TIME);
    expect(storage.remove).not.toHaveBeenCalled();
    expect(masterRepository.markExcelExportFileRemoved).not.toHaveBeenCalled();
    expect(masterRepository.markExcelExportReady).toHaveBeenCalled();
  });

  it("期限切れが複数ある場合、すべて削除してから本処理を完了する", async () => {
    setUpSuccessfulGeneration();
    vi.mocked(masterRepository.listExpiredExcelExportFiles).mockResolvedValue([
      expiredFileA,
      expiredFileB,
    ]);
    vi.mocked(masterRepository.markExcelExportFileRemoved).mockResolvedValue(true);

    await runMasterExcelExport(EXPORT_ID);

    expect(storage.remove).toHaveBeenCalledWith(expiredFileA.filePath);
    expect(storage.remove).toHaveBeenCalledWith(expiredFileB.filePath);
    expect(masterRepository.markExcelExportFileRemoved).toHaveBeenCalledWith(expiredFileA.id);
    expect(masterRepository.markExcelExportFileRemoved).toHaveBeenCalledWith(expiredFileB.id);
  });

  it("1件の削除に失敗しても、他の対象は削除され、本処理も成功する", async () => {
    setUpSuccessfulGeneration();
    vi.mocked(masterRepository.listExpiredExcelExportFiles).mockResolvedValue([
      expiredFileA,
      expiredFileB,
    ]);
    vi.mocked(storage.remove).mockImplementation((filePath) =>
      filePath === expiredFileA.filePath
        ? Promise.reject(new Error("削除に失敗した"))
        : Promise.resolve(),
    );
    vi.mocked(masterRepository.markExcelExportFileRemoved).mockResolvedValue(true);

    await runMasterExcelExport(EXPORT_ID);

    // 失敗した対象は記録されず、成功した対象だけ記録される
    expect(masterRepository.markExcelExportFileRemoved).not.toHaveBeenCalledWith(expiredFileA.id);
    expect(masterRepository.markExcelExportFileRemoved).toHaveBeenCalledWith(expiredFileB.id);
    // 掃除の失敗は本処理に伝わらない
    expect(masterRepository.markExcelExportReady).toHaveBeenCalled();
    expect(masterRepository.markExcelExportFailed).not.toHaveBeenCalled();
  });

  it("対象一覧の取得自体に失敗しても、本処理は成功する", async () => {
    setUpSuccessfulGeneration();
    vi.mocked(masterRepository.listExpiredExcelExportFiles).mockRejectedValue(
      new Error("一覧の取得に失敗した"),
    );

    await runMasterExcelExport(EXPORT_ID);

    expect(masterRepository.markExcelExportReady).toHaveBeenCalled();
    expect(masterRepository.markExcelExportFailed).not.toHaveBeenCalled();
  });

  it("掃除は本処理（Excelの組み立て）より先に実行される", async () => {
    setUpSuccessfulGeneration();
    vi.mocked(masterRepository.listExpiredExcelExportFiles).mockResolvedValue([expiredFileA]);
    vi.mocked(masterRepository.markExcelExportFileRemoved).mockResolvedValue(true);

    await runMasterExcelExport(EXPORT_ID);

    // invocationCallOrder は「全体で何番目に呼ばれたか」を表す通し番号。
    // 掃除の削除が、Excelの元データを取り出すより先に行われたことを、この番号の大小で確かめる。
    const removeOrder = vi.mocked(storage.remove).mock.invocationCallOrder[0];
    const buildOrder = vi.mocked(masterRepository.listCategoriesForExport).mock
      .invocationCallOrder[0];
    expect(removeOrder).toBeLessThan(buildOrder);
  });
});
