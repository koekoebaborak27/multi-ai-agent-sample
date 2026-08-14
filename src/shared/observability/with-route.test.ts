/**
 * 対象: shared/observability withRoute 処理を包んで記録を残す仕組み
 * 目的: 成功・失敗それぞれで意図した記録が残ること、
 *       ログイン中の利用者情報（userId/role）が記録に含まれること、
 *       未ログインでも動作が壊れないことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// 実際に記録を出力すると内容を確認できないため、記録係を差し替えて中身を捕まえる
const { errorMock, infoMock, debugMock, childLoggerMock, getCurrentUserMock } = vi.hoisted(() => {
  const errorMock = vi.fn();
  const infoMock = vi.fn();
  const debugMock = vi.fn();
  const childLoggerMock = vi.fn((_ctx?: Record<string, unknown>) => ({
    error: errorMock,
    info: infoMock,
    debug: debugMock,
  }));
  const getCurrentUserMock = vi.fn();
  return { errorMock, infoMock, debugMock, childLoggerMock, getCurrentUserMock };
});

vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
  logger: { error: errorMock, info: infoMock, debug: debugMock },
}));

vi.mock("@/shared/auth/session", () => ({
  getCurrentUser: getCurrentUserMock,
}));

import { withRoute } from "@/shared/observability/with-route";
import { AppError } from "@/shared/errors/app-error";

beforeEach(() => {
  errorMock.mockClear();
  infoMock.mockClear();
  debugMock.mockClear();
  childLoggerMock.mockClear();
  getCurrentUserMock.mockReset();
});

describe("withRoute", () => {
  it("ログイン中は成功時の記録に userId/role を含める", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-1", role: "ADMIN" });
    const wrapped = withRoute("test.ok", async () => new Response(null, { status: 200 }));

    const res = await wrapped(new Request("http://localhost/api/test"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toEqual(expect.any(String));
    expect(childLoggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ op: "test.ok", userId: "user-1", role: "ADMIN" }),
    );
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("未ログインでも動作し、記録に userId/role を含めない", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    const wrapped = withRoute("test.anonymous", async () => new Response(null, { status: 200 }));

    await wrapped(new Request("http://localhost/api/test"));
    const ctx = childLoggerMock.mock.calls[0]?.[0] as unknown as Record<string, unknown>;
    expect(ctx).not.toHaveProperty("userId");
    expect(ctx).not.toHaveProperty("role");
  });

  it("例外時は error を1件だけ出し、失敗時も利用者情報を含める", async () => {
    getCurrentUserMock.mockResolvedValue({ id: "user-2", role: "GENERAL" });
    const wrapped = withRoute("test.fail", async () => {
      throw new AppError("X_FAIL", 400, "失敗しました");
    });

    const res = await wrapped(new Request("http://localhost/api/test"));
    expect(res.status).toBe(400);
    expect(childLoggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ op: "test.fail", userId: "user-2", role: "GENERAL" }),
    );
    expect(errorMock).toHaveBeenCalledTimes(1);
  });
});
