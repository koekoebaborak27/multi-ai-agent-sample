import { masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { Errors } from "@/shared/errors/app-error";
import { withRoute } from "@/shared/observability/with-route";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * マスタ分類一覧（MST-06）のCSVダウンロードの窓口。
 * 検索条件が無いため常に全件を対象に、その場でCSVを組み立てて1回のレスポンスで返す。
 */
export const GET = withRoute("master.category.export.csv", async () => {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();

  const { fileName, data } = await masterService.exportCategoryCsv();

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
