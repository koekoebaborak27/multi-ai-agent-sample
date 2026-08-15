/**
 * 対象: api/master/exports/csv マスタ検索一覧（MST-01）のCSVダウンロードの窓口
 * 目的: ログイン確認を行うこと、検索条件をクエリパラメータから正しく組み立てて渡すこと、
 *       その場で生成したCSVをファイル名つきで返すことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";

// 記録係・ログイン確認・業務処理を差し替える。実際のデータベースが無くても試験できるようにするため。
const { childLoggerMock, getCurrentUserMock, exportMasterCsvMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })),
    getCurrentUserMock: vi.fn(),
    exportMasterCsvMock: vi.fn(),
  };
});

vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));
vi.mock("@/shared/auth/session", () => ({
  getCurrentUser: getCurrentUserMock,
}));
vi.mock("@/modules/master", () => ({
  masterService: { exportMasterCsv: exportMasterCsvMock },
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/master/exports/csv/route";

beforeEach(() => {
  getCurrentUserMock.mockReset();
  exportMasterCsvMock.mockReset();
});

describe("GET /api/master/exports/csv", () => {
  it("検索条件をそのままservice.exportMasterCsvへ渡し、CSVをファイル名つきで返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    exportMasterCsvMock.mockResolvedValue({
      fileName: "master_20260812120000.csv",
      data: Buffer.from("csv-content"),
    });

    const res = await GET(
      new Request("http://localhost/api/master/exports/csv?categoryId=3&keyword=%20con%20"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="master_20260812120000.csv"',
    );
    await expect(res.text()).resolves.toBe("csv-content");
    expect(exportMasterCsvMock).toHaveBeenCalledWith({ categoryId: 3, keyword: "con" });
  });

  it("分類が「all」のときは絞り込み無しとして渡す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    exportMasterCsvMock.mockResolvedValue({
      fileName: "master_20260812120000.csv",
      data: Buffer.from("csv-content"),
    });

    await GET(new Request("http://localhost/api/master/exports/csv?categoryId=all"));

    expect(exportMasterCsvMock).toHaveBeenCalledWith({ categoryId: undefined, keyword: undefined });
  });

  it("未ログインならUNAUTHORIZEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/master/exports/csv"));

    expect(res.status).toBe(401);
    expect(exportMasterCsvMock).not.toHaveBeenCalled();
  });

  it("対象件数が上限を超える場合はMASTER_EXPORT_LIMIT_EXCEEDEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    exportMasterCsvMock.mockRejectedValue(
      new AppError("MASTER_EXPORT_LIMIT_EXCEEDED", 422, "対象が10001件あります"),
    );

    const res = await GET(new Request("http://localhost/api/master/exports/csv"));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXPORT_LIMIT_EXCEEDED");
  });
});
