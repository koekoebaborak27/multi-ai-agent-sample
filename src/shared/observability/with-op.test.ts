import { beforeEach, describe, expect, it, vi } from "vitest";

// logger をモックして出力を捕捉する
const { errorMock, infoMock, debugMock, childLoggerMock } = vi.hoisted(() => {
  const errorMock = vi.fn();
  const infoMock = vi.fn();
  const debugMock = vi.fn();
  const childLoggerMock = vi.fn(() => ({ error: errorMock, info: infoMock, debug: debugMock }));
  return { errorMock, infoMock, debugMock, childLoggerMock };
});

vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
  logger: { error: errorMock, info: infoMock, debug: debugMock },
}));

import { withOp } from "@/shared/observability/with-op";
import { AppError } from "@/shared/errors/app-error";

beforeEach(() => {
  errorMock.mockClear();
  infoMock.mockClear();
  debugMock.mockClear();
  childLoggerMock.mockClear();
});

describe("withOp", () => {
  it("成功時は info を出力し戻り値を返す（error は出さない）", async () => {
    const wrapped = withOp("test.ok", async (x: number) => x + 1);
    await expect(wrapped(1)).resolves.toBe(2);
    expect(infoMock).toHaveBeenCalledTimes(1);
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("例外時は error を1件だけ出し、requestId/op を含めて再スローする", async () => {
    const wrapped = withOp("test.fail", async () => {
      throw new AppError("X_FAIL", 400, "失敗しました");
    });
    await expect(wrapped()).rejects.toThrowError("失敗しました");

    // childLogger に op / requestId がバインドされている
    expect(childLoggerMock).toHaveBeenCalledWith(
      expect.objectContaining({ op: "test.fail", requestId: expect.any(String) }),
    );
    // エラーログは1件、err を含み、メッセージに op を含む
    expect(errorMock).toHaveBeenCalledTimes(1);
    const [meta, msg] = errorMock.mock.calls[0] as [{ err: unknown }, string];
    expect(meta.err).toBeInstanceOf(AppError);
    expect(msg).toContain("test.fail");
  });

  it("Next.js の redirect(制御フロー例外)は error 扱いしない", async () => {
    const wrapped = withOp("test.redirect", async () => {
      const e = new Error("redirect") as Error & { digest?: string };
      e.digest = "NEXT_REDIRECT;replace;/;307;";
      throw e;
    });
    await expect(wrapped()).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(errorMock).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledTimes(1);
  });
});
