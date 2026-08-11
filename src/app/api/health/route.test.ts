/**
 * 対象: api/health アプリの稼働確認の窓口
 * 目的: 既定の確認ではデータベースへ問い合わせないこと、
 *       データベースの確認を指定したときだけ問い合わせ、つながらなければ異常として返すことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// 記録係とデータベースを差し替える。実際のデータベースが無くても試験できるようにするため。
const { childLoggerMock, queryRawMock } = vi.hoisted(() => {
  const noop = vi.fn();
  const childLoggerMock = vi.fn(() => ({ error: noop, info: noop, debug: noop, warn: noop }));
  const queryRawMock = vi.fn();
  return { childLoggerMock, queryRawMock };
});

vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
  logger: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock("@/shared/db/prisma", () => ({
  prisma: { $queryRaw: queryRawMock },
}));

// 差し替えの設定が済んでから読み込む必要があるため、この位置で読み込んでいる
import { GET } from "@/app/api/health/route";

beforeEach(() => {
  queryRawMock.mockReset();
});

describe("GET /api/health", () => {
  it("既定（liveness）は 200 で status:ok を返し、DB ping しない", async () => {
    const res = await GET(new Request("http://localhost/api/health"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { status: "ok" } });
    expect(queryRawMock).not.toHaveBeenCalled();
  });

  it("?check=db で DB 疎通成功なら 200 で db:up を返す", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);
    const res = await GET(new Request("http://localhost/api/health?check=db"));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ data: { status: "ok", db: "up" } });
    expect(queryRawMock).toHaveBeenCalledTimes(1);
  });

  it("?check=db で DB 疎通失敗なら 503 で db:down を返す", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection refused"));
    const res = await GET(new Request("http://localhost/api/health?check=db"));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual({ data: { status: "degraded", db: "down" } });
  });
});
