/**
 * 対象: api/master/exports/[exportId] CSVダウンロードの受け取り窓口
 * 目的: ログイン確認を行うこと、生成済みのCSVをファイル名つきで返すこと、
 *       まだ生成が終わっていない場合はエラーで応答することを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";

// 記録係・ログイン確認・業務処理を差し替える。実際のデータベースやストレージが無くても試験できるようにするため。
const { childLoggerMock, getCurrentUserMock, downloadExportMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })),
    getCurrentUserMock: vi.fn(),
    downloadExportMock: vi.fn(),
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
  masterService: { downloadExport: downloadExportMock },
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/master/exports/[exportId]/route";

function makeContext(exportId: string) {
  return { params: Promise.resolve({ exportId }) };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
  downloadExportMock.mockReset();
});

describe("GET /api/master/exports/[exportId]", () => {
  it("READYであればCSVをファイル名つきで返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    downloadExportMock.mockResolvedValue({
      fileName: "master_20260812120000.csv",
      data: Buffer.from("csv-content"),
    });

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="master_20260812120000.csv"',
    );
    await expect(res.text()).resolves.toBe("csv-content");
    expect(downloadExportMock).toHaveBeenCalledWith("exp1", "user1");
  });

  it("未ログインならUNAUTHORIZEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(401);
    expect(downloadExportMock).not.toHaveBeenCalled();
  });

  it("生成が終わっていない場合はMASTER_EXPORT_NOT_READYを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    downloadExportMock.mockRejectedValue(
      new AppError("MASTER_EXPORT_NOT_READY", 409, "まだ生成が終わっていません"),
    );

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXPORT_NOT_READY");
  });
});
