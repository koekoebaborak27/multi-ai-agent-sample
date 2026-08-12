import { masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { Errors } from "@/shared/errors/app-error";
import { withRoute } from "@/shared/observability/with-route";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * CSVダウンロードの受け取り窓口（§13.5.3）。
 * 生成済みのファイルを1回だけ返し、返した直後にファイルと依頼の記録を削除する（§13.9.2）。
 * 署名URLへのリダイレクトは行わず、本人確認を通ったこのアプリ経由でだけファイルを渡す。
 */
export const GET = withRoute("master.export.download", async (_req: Request, ctx?: unknown) => {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();

  const { exportId } = await (ctx as { params: Promise<{ exportId: string }> }).params;
  const { fileName, data } = await masterService.downloadExport(exportId, user.id);

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
