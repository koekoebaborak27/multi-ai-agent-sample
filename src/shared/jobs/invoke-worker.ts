import { env } from "@/shared/config/env";
import { logger } from "@/shared/observability/logger";

// アプリから worker（Cloud Run Jobs）を単発で起動する処理（設計書§40.7）。
//
// 起動要求（Cloud Run Admin API）に必要なトークンは、Cloud Run 上でのみ到達できる
// メタデータサーバーから取得する。Supabase のファイル保管場所とのやり取り
// （shared/storage/supabase.ts）と同じく、専用の追加ライブラリは使わず fetch で完結させている。
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

/** 自分が誰かを示すための、その場限りのトークンを取得する */
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
 * worker を起動する。本番（WORKER_INVOKE_MODE=cloud-run-job）のときだけ実際に起動要求を送り、
 * ローカル（既定の none）では何もしない。ローカルは `pnpm worker` で常駐させたものが
 * 順番待ちの列を見ているため、起動要求そのものが不要なため。
 *
 * 起動要求が失敗しても、この関数は例外を投げず記録を残すだけにする（設計書§40.10）。
 * 依頼そのものは既に順番待ちの列に積まれており、次にいずれかの依頼が処理される
 * タイミングで一緒に処理されるため、利用者の依頼を失敗扱いにする必要がないため。
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
        "worker起動要求に失敗しました（依頼は順番待ちの列に残っています）",
      );
    }
  } catch (err) {
    logger.warn({ err }, "worker起動要求に失敗しました（依頼は順番待ちの列に残っています）");
  }
}
