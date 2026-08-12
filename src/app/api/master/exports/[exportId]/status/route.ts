import { masterService } from "@/modules/master";
import { ok } from "@/shared/api/response";
import { getCurrentUser } from "@/shared/auth/session";
import { Errors } from "@/shared/errors/app-error";
import { withRoute } from "@/shared/observability/with-route";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSVダウンロードの生成状況を確認する窓口（§13.5.3）。
 * 画面は依頼で受け取った exportId を使い、2秒間隔でここへ問い合わせて完了を待つ（§13.10.1）。
 * `/api` は proxy.ts の matcher から外れているため、ここで自分でログインを確認する。
 */
export const GET = withRoute("master.export.status", async (_req: Request, ctx?: unknown) => {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();

  const { exportId } = await (ctx as { params: Promise<{ exportId: string }> }).params;
  const status = await masterService.getExportStatus(exportId, user.id);
  return ok(status);
});
