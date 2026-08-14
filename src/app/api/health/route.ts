import { withRoute } from "@/shared/observability/with-route";
import { ok } from "@/shared/api/response";
import { prisma } from "@/shared/db/prisma";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * アプリが正常に動いているかを、外部の監視の仕組みから確認するための窓口。
 * ログインの確認対象から外れているため、ログインしなくても到達できる。
 *
 * - `GET /api/health`          : アプリが応答するかどうかだけを確認する。
 *   データベースへは問い合わせない。一時的にデータベースへつながらなくなっただけで
 *   アプリ全体が停止扱いにされてしまうのを避けるため。
 * - `GET /api/health?check=db` : データベースへ実際に問い合わせ、つながるかどうかまで確認する。
 */
export const GET = withRoute("health.get", async (req: Request) => {
  const url = new URL(req.url);

  if (url.searchParams.get("check") === "db") {
    try {
      // 内容に意味のない最小の問い合わせを送り、応答が返るかどうかだけを確かめる
      await prisma.$queryRaw`SELECT 1`;
      return ok({ status: "ok", db: "up" });
    } catch {
      return Response.json({ data: { status: "degraded", db: "down" } }, { status: 503 });
    }
  }

  return ok({ status: "ok" });
});
