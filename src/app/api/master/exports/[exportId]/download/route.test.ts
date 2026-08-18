/**
 * 対象: api/master/exports/[exportId]/download マスタ情報Excel取得（MST-11）のダウンロードの窓口
 * 目的: ログイン確認を行うこと、URLの実行履歴IDをそのままservice層へ渡すこと、
 *       ファイルの中身をファイル名つきで返すこと、ロールによる制限が無いこと（設計書§40.4）を担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";

// 記録係・ログイン確認・業務処理を差し替える。実際のデータベースが無くても試験できるようにするため。
const { childLoggerMock, getCurrentUserMock, getExcelExportDownloadMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })),
    getCurrentUserMock: vi.fn(),
    getExcelExportDownloadMock: vi.fn(),
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
  masterService: { getExcelExportDownload: getExcelExportDownloadMock },
  MASTER_EXCEL_EXPORT_CONTENT_TYPE:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/master/exports/[exportId]/download/route";

function buildCtx(exportId: string) {
  return { params: Promise.resolve({ exportId }) };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
  getExcelExportDownloadMock.mockReset();
});

describe("GET /api/master/exports/[exportId]/download", () => {
  it("履歴のIDをそのままserviceへ渡し、Excelの種別とファイル名を付けて中身を返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "VIEWER" });
    getExcelExportDownloadMock.mockResolvedValue({
      fileName: "master_info_20260817103000.xlsx",
      data: Buffer.from("excel-content"),
    });

    const res = await GET(
      new Request("http://localhost/api/master/exports/export-9/download"),
      buildCtx("export-9"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="master_info_20260817103000.xlsx"',
    );
    await expect(res.text()).resolves.toBe("excel-content");
    expect(getExcelExportDownloadMock).toHaveBeenCalledWith("export-9");
  });

  it("未ログインならUNAUTHORIZEDを返し、serviceを呼ばない", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/master/exports/export-9/download"),
      buildCtx("export-9"),
    );

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect(getExcelExportDownloadMock).not.toHaveBeenCalled();
  });

  it("履歴が見つからない場合はMASTER_EXCEL_EXPORT_NOT_FOUNDを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    getExcelExportDownloadMock.mockRejectedValue(
      new AppError("MASTER_EXCEL_EXPORT_NOT_FOUND", 404, "対象の実行履歴が見つかりません"),
    );

    const res = await GET(
      new Request("http://localhost/api/master/exports/does-not-exist/download"),
      buildCtx("does-not-exist"),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXCEL_EXPORT_NOT_FOUND");
  });

  it("保持期限が切れている場合はMASTER_EXCEL_EXPORT_EXPIREDを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    getExcelExportDownloadMock.mockRejectedValue(
      new AppError("MASTER_EXCEL_EXPORT_EXPIRED", 410, "ファイルの有効期限が切れています"),
    );

    const res = await GET(
      new Request("http://localhost/api/master/exports/export-9/download"),
      buildCtx("export-9"),
    );

    expect(res.status).toBe(410);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXCEL_EXPORT_EXPIRED");
  });

  it("権限の低い利用者（VIEWER）でもロールで拒否せずダウンロードできる（設計書§40.4）", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "viewer1", role: "VIEWER" });
    getExcelExportDownloadMock.mockResolvedValue({
      fileName: "master_info_20260817103000.xlsx",
      data: Buffer.from("excel-content"),
    });

    const res = await GET(
      new Request("http://localhost/api/master/exports/export-9/download"),
      buildCtx("export-9"),
    );

    expect(res.status).toBe(200);
  });
});
