/**
 * 対象: shared/jobs/invoke-worker
 * 目的: 本番（WORKER_INVOKE_MODE=cloud-run-job）のときだけ、メタデータサーバーから
 *       取得したトークンを使って Cloud Run Admin API の正しい宛先へ起動要求を送ること、
 *       ローカル（none）のときは何も送らないこと、起動要求が失敗しても例外を投げず
 *       ログにだけ残すことを担保する（設計書§30.1.7.4）。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const ACCESS_TOKEN = "dummy-access-token";

// vi.mock は巻き上げられるため、factory 内で参照する変数は vi.hoisted で先に定義する
const { envMock, loggerWarnMock } = vi.hoisted(() => ({
  envMock: {
    WORKER_INVOKE_MODE: "none" as "none" | "cloud-run-job",
    GOOGLE_CLOUD_PROJECT: "sample-project",
    CLOUD_RUN_JOB_REGION: "us-central1",
    CLOUD_RUN_JOB_NAME: "master-export-worker",
  },
  loggerWarnMock: vi.fn(),
}));
vi.mock("@/shared/config/env", () => ({ env: envMock }));
vi.mock("@/shared/observability/logger", () => ({ logger: { warn: loggerWarnMock } }));

import { invokeWorker } from "@/shared/jobs/invoke-worker";

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  loggerWarnMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  envMock.WORKER_INVOKE_MODE = "none";
});

describe("shared/jobs/invoke-worker", () => {
  describe("WORKER_INVOKE_MODE が none のとき", () => {
    it("fetch を一度も呼ばない", async () => {
      await invokeWorker();

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("WORKER_INVOKE_MODE が cloud-run-job のとき", () => {
    beforeEach(() => {
      envMock.WORKER_INVOKE_MODE = "cloud-run-job";
    });

    it("メタデータサーバーからトークンを取得し、Cloud Run Admin API へ起動要求を送る", async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: ACCESS_TOKEN }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 200 }));

      await invokeWorker();

      expect(fetchMock).toHaveBeenCalledTimes(2);

      const [metadataUrl, metadataInit] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(metadataUrl).toBe(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      );
      expect((metadataInit.headers as Record<string, string>)["Metadata-Flavor"]).toBe("Google");

      const [runUrl, runInit] = fetchMock.mock.calls[1] as [string, RequestInit];
      expect(runUrl).toBe(
        "https://run.googleapis.com/v2/projects/sample-project/locations/us-central1/jobs/master-export-worker:run",
      );
      expect(runInit.method).toBe("POST");
      expect((runInit.headers as Record<string, string>).Authorization).toBe(
        `Bearer ${ACCESS_TOKEN}`,
      );
    });

    it("起動要求が失敗しても例外を投げず、警告ログに残す", async () => {
      fetchMock
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: ACCESS_TOKEN }), { status: 200 }),
        )
        .mockResolvedValueOnce(new Response(null, { status: 500 }));

      await expect(invokeWorker()).resolves.toBeUndefined();
      expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });

    it("トークン取得自体が失敗しても例外を投げず、警告ログに残す", async () => {
      fetchMock.mockRejectedValueOnce(new Error("network error"));

      await expect(invokeWorker()).resolves.toBeUndefined();
      expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    });
  });
});
