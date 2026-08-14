/**
 * 対象: api/master/exports/[exportId]/status CSVダウンロードの状態確認窓口
 * 目的: ログイン確認を行うこと、状態確認の結果をそのまま返すこと、
 *       依頼が見つからない・他人の依頼のときは同じエラーで応答することを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";

// 記録係・ログイン確認・業務処理を差し替える。実際のデータベースが無くても試験できるようにするため。
const { childLoggerMock, getCurrentUserMock, getExportStatusMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })),
    getCurrentUserMock: vi.fn(),
    getExportStatusMock: vi.fn(),
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
  masterService: { getExportStatus: getExportStatusMock },
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/master/exports/[exportId]/status/route";

function makeContext(exportId: string) {
  return { params: Promise.resolve({ exportId }) };
}

beforeEach(() => {
  getCurrentUserMock.mockReset();
  getExportStatusMock.mockReset();
});

describe("GET /api/master/exports/[exportId]/status", () => {
  it("ログインしていれば状態確認の結果をそのまま返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    getExportStatusMock.mockResolvedValue({ status: "RUNNING" });

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1/status"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { status: "RUNNING" } });
    expect(getExportStatusMock).toHaveBeenCalledWith("exp1", "user1");
  });

  it("未ログインならUNAUTHORIZEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1/status"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(401);
    expect(getExportStatusMock).not.toHaveBeenCalled();
  });

  it("依頼が見つからない・他人の依頼の場合はMASTER_EXPORT_NOT_FOUNDを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    getExportStatusMock.mockRejectedValue(
      new AppError("MASTER_EXPORT_NOT_FOUND", 404, "指定されたダウンロードが見つかりません"),
    );

    const res = await GET(
      new Request("http://localhost/api/master/exports/exp1/status"),
      makeContext("exp1"),
    );

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXPORT_NOT_FOUND");
  });
});
