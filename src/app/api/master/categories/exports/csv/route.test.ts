/**
 * 対象: api/master/categories/exports/csv マスタ分類一覧（MST-06）のCSVダウンロードの窓口
 * 目的: ログイン確認を行うこと、その場で生成したCSVをファイル名つきで返すことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/errors/app-error";

// 記録係・ログイン確認・業務処理を差し替える。実際のデータベースが無くても試験できるようにするため。
const { childLoggerMock, getCurrentUserMock, exportCategoryCsvMock } = vi.hoisted(() => {
  const noop = vi.fn();
  return {
    childLoggerMock: vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop })),
    getCurrentUserMock: vi.fn(),
    exportCategoryCsvMock: vi.fn(),
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
  masterService: { exportCategoryCsv: exportCategoryCsvMock },
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/master/categories/exports/csv/route";

beforeEach(() => {
  getCurrentUserMock.mockReset();
  exportCategoryCsvMock.mockReset();
});

describe("GET /api/master/categories/exports/csv", () => {
  it("その場で生成したCSVをファイル名つきで返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    exportCategoryCsvMock.mockResolvedValue({
      fileName: "master_categories_20260812120000.csv",
      data: Buffer.from("csv-content"),
    });

    const res = await GET(new Request("http://localhost/api/master/categories/exports/csv"));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toBe(
      'attachment; filename="master_categories_20260812120000.csv"',
    );
    await expect(res.text()).resolves.toBe("csv-content");
  });

  it("未ログインならUNAUTHORIZEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    const res = await GET(new Request("http://localhost/api/master/categories/exports/csv"));

    expect(res.status).toBe(401);
    expect(exportCategoryCsvMock).not.toHaveBeenCalled();
  });

  it("対象件数が上限を超える場合はMASTER_EXPORT_LIMIT_EXCEEDEDを返す", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user1", role: "ADMIN" });
    exportCategoryCsvMock.mockRejectedValue(
      new AppError("MASTER_EXPORT_LIMIT_EXCEEDED", 422, "対象が10001件あります"),
    );

    const res = await GET(new Request("http://localhost/api/master/categories/exports/csv"));

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("MASTER_EXPORT_LIMIT_EXCEEDED");
  });
});
