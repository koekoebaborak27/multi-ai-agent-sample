/**
 * 対象: shared/storage/supabase
 * 目的: Supabase Storage への REST 呼び出しが、新旧どちらの API キー形式でも認証が通るヘッダ
 *       （Authorization + apikey）を送ることを担保する。
 *       apikey が欠けると、新形式キー（`sb_secret_...`）は JWT ではないため Supabase 側の
 *       パースに失敗し `Invalid Compact JWS`（HTTP 400）で全操作が拒否される。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// server-only は react-server 条件でのみ空実装に解決されるため、テストでは無効化する
vi.mock("server-only", () => ({}));

const KEY = "sb_secret_dummy";
const BUCKET = "uploads";

vi.mock("@/shared/config/env", () => ({
  env: {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "sb_secret_dummy",
    SUPABASE_STORAGE_BUCKET: "uploads",
  },
}));

import { isAppError } from "@/shared/errors/app-error";
import { supabaseStorage } from "@/shared/storage/supabase";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

/** 直近の fetch 呼び出しに渡されたヘッダ */
function sentHeaders(): Record<string, string> {
  const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
  return (init?.headers ?? {}) as Record<string, string>;
}

/** 直近の fetch 呼び出しの URL */
function sentUrl(): string {
  return fetchMock.mock.calls[0]?.[0] as string;
}

/** code だけを取り出す（AppError 以外は再スローする） */
async function codeOf(op: Promise<unknown>): Promise<string> {
  try {
    await op;
  } catch (e) {
    if (isAppError(e)) return e.code;
    throw e;
  }
  throw new Error("AppError が投げられませんでした");
}

describe("shared/storage/supabase", () => {
  describe("upload", () => {
    describe("正常系", () => {
      beforeEach(() => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
      });

      it("Authorization と apikey の両方にキーを載せて送る", async () => {
        await supabaseStorage.upload("a/b.txt", Buffer.from("x"), "text/plain");

        expect(sentHeaders().Authorization).toBe(`Bearer ${KEY}`);
        expect(sentHeaders().apikey).toBe(KEY);
      });

      it("バケットとパスを含む object URL へ POST する", async () => {
        await supabaseStorage.upload("a/b.txt", Buffer.from("x"), "text/plain");

        expect(sentUrl()).toBe(`https://example.supabase.co/storage/v1/object/${BUCKET}/a/b.txt`);
        expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("POST");
      });

      it("contentType 未指定なら application/octet-stream を送る", async () => {
        await supabaseStorage.upload("a/b.bin", Buffer.from("x"));

        expect(sentHeaders()["Content-Type"]).toBe("application/octet-stream");
      });
    });

    describe("応答がエラーのとき", () => {
      it("AppError(STORAGE_UPLOAD_FAILED) を投げる", async () => {
        fetchMock.mockResolvedValue(new Response("{}", { status: 400 }));

        await expect(codeOf(supabaseStorage.upload("a/b.txt", Buffer.from("x")))).resolves.toBe(
          "STORAGE_UPLOAD_FAILED",
        );
      });
    });
  });

  describe("download", () => {
    describe("正常系", () => {
      it("Authorization と apikey の両方にキーを載せて送る", async () => {
        fetchMock.mockResolvedValue(new Response(Buffer.from("body"), { status: 200 }));

        await supabaseStorage.download("a/b.txt");

        expect(sentHeaders().Authorization).toBe(`Bearer ${KEY}`);
        expect(sentHeaders().apikey).toBe(KEY);
      });

      it("応答本文を Buffer で返す", async () => {
        fetchMock.mockResolvedValue(new Response(Buffer.from("body"), { status: 200 }));

        await expect(supabaseStorage.download("a/b.txt")).resolves.toEqual(Buffer.from("body"));
      });
    });

    describe("応答がエラーのとき", () => {
      it("AppError(STORAGE_DOWNLOAD_FAILED) を投げる", async () => {
        fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));

        await expect(codeOf(supabaseStorage.download("a/b.txt"))).resolves.toBe(
          "STORAGE_DOWNLOAD_FAILED",
        );
      });
    });
  });

  describe("remove", () => {
    describe("正常系", () => {
      it("Authorization と apikey の両方にキーを載せて DELETE する", async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await supabaseStorage.remove("a/b.txt");

        expect(sentHeaders().Authorization).toBe(`Bearer ${KEY}`);
        expect(sentHeaders().apikey).toBe(KEY);
        expect((fetchMock.mock.calls[0][1] as RequestInit).method).toBe("DELETE");
      });
    });

    describe("応答がエラーのとき", () => {
      it("AppError(STORAGE_DELETE_FAILED) を投げる", async () => {
        fetchMock.mockResolvedValue(new Response("{}", { status: 500 }));

        await expect(codeOf(supabaseStorage.remove("a/b.txt"))).resolves.toBe(
          "STORAGE_DELETE_FAILED",
        );
      });
    });
  });

  describe("getPublicUrl", () => {
    it("public プレフィックス付きの URL を組み立てる（非公開バケットでは取得できない）", () => {
      expect(supabaseStorage.getPublicUrl("a/b.txt")).toBe(
        `https://example.supabase.co/storage/v1/object/public/${BUCKET}/a/b.txt`,
      );
    });
  });
});
