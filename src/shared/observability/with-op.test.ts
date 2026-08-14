/**
 * 対象: shared/observability withOp 処理を包んで記録を残す仕組み
 * 目的: 成功・失敗それぞれで意図した記録が残ること、
 *       とくに失敗の記録が1件だけであること、
 *       画面移動の指示を失敗として記録しないことを担保する
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// 実際に記録を出力すると内容を確認できないため、記録係を差し替えて中身を捕まえる
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

  it("監査用オプションが有効な成功時は info に引数を含める", async () => {
    const input = { before: "契約種別", after: "請求区分" };
    const wrapped = withOp("test.audit", async (value: typeof input) => value.after, {
      includeArgsInSuccessLog: true,
    });

    await expect(wrapped(input)).resolves.toBe("請求区分");
    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({ args: [input] }),
      "✓ test.audit",
    );
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

  it("Next.js の redirect(制御フロー例外)は error 扱いせず監査用引数をinfoへ含める", async () => {
    const input = { before: "契約種別", after: "請求区分" };
    const wrapped = withOp(
      "test.redirect",
      async (_value: typeof input) => {
        const e = new Error("redirect") as Error & { digest?: string };
        e.digest = "NEXT_REDIRECT;replace;/;307;";
        throw e;
      },
      { includeArgsInSuccessLog: true },
    );
    await expect(wrapped(input)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
    expect(errorMock).not.toHaveBeenCalled();
    expect(infoMock).toHaveBeenCalledWith(
      expect.objectContaining({ args: [input] }),
      "✓ test.redirect (redirect)",
    );
  });
});
