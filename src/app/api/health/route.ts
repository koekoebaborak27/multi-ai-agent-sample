import { withRoute } from "@/shared/observability/with-route";
import { ok } from "@/shared/api/response";
import { prisma } from "@/shared/db/prisma";

// Prisma を使うため Node ランタイム固定・キャッシュ無効（毎回評価）。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ヘルスチェック（§8 ALB / 運用監視）。
 * proxy.ts の matcher が `api` を除外しているため認証不要で到達できる。
 *
 * - 既定 `GET /api/health`         : 軽量 liveness。プロセス応答のみ確認（DB ping しない）。
 *   ALB ターゲットグループのヘルスチェック用。DB 瞬断で全タスクが drain される事故を避ける。
 * - `GET /api/health?check=db`     : readiness。`SELECT 1` で DB 疎通を確認。失敗時 503。
 */
export const GET = withRoute("health.get", async (req: Request) => {
  const url = new URL(req.url);

  if (url.searchParams.get("check") === "db") {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return ok({ status: "ok", db: "up" });
    } catch {
      return Response.json({ data: { status: "degraded", db: "down" } }, { status: 503 });
    }
  }

  return ok({ status: "ok" });
});
