import { env } from "@/shared/config/env";
import { logger } from "@/shared/observability/logger";

// worker の起動要求（Cloud Run Admin API）に必要なトークンを、
// Cloud Run上でのみ到達できるメタデータサーバーから取得する。
// Supabase Storage との通信（shared/storage/supabase.ts）と同じく、
// 専用の追加ライブラリは使わず fetch で完結させる。
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

async function fetchAccessToken(): Promise<string> {
  const res = await fetch(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
  if (!res.ok) {
    throw new Error(`メタデータサーバーからのトークン取得に失敗しました (status ${res.status})`);
  }
  const body = (await res.json()) as { access_token?: string };
  if (!body.access_token) {
    throw new Error("メタデータサーバーの応答に access_token が含まれていません");
  }
  return body.access_token;
}

/**
 * 本番でだけ、Cloud Run Jobs として worker を1回起動するよう要求する。
 *
 * 起動要求そのものが失敗しても、ジョブは既に pg-boss へ積まれているため、
 * 呼び出し側（依頼の Server Action）を失敗させず、ログにだけ残す（設計書§30.1.7.4）。
 */
export async function invokeWorker(): Promise<void> {
  if (env.WORKER_INVOKE_MODE !== "cloud-run-job") return;

  try {
    const token = await fetchAccessToken();
    const url = `https://run.googleapis.com/v2/projects/${env.GOOGLE_CLOUD_PROJECT}/locations/${env.CLOUD_RUN_JOB_REGION}/jobs/${env.CLOUD_RUN_JOB_NAME}:run`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      logger.warn(
        { status: res.status },
        "worker起動要求に失敗しました（ジョブはキューに残っています）",
      );
    }
  } catch (err) {
    logger.warn({ err }, "worker起動要求に失敗しました（ジョブはキューに残っています）");
  }
}
