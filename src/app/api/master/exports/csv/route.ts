import { masterService } from "@/modules/master";
import { requestMasterExportSchema } from "@/modules/master/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { Errors } from "@/shared/errors/app-error";
import { withRoute } from "@/shared/observability/with-route";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * マスタ検索一覧（MST-01）のCSVダウンロードの窓口。
 * 一覧画面と同じ検索条件（分類・キーワード）をクエリパラメータで受け取り、
 * その場でCSVを組み立てて1回のレスポンスで返す。
 */
export const GET = withRoute("master.export.csv", async (req: Request) => {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();

  const url = new URL(req.url);
  const parsed = requestMasterExportSchema.parse({
    categoryId: url.searchParams.get("categoryId") ?? "",
    keyword: url.searchParams.get("keyword") ?? "",
  });
  // 一覧画面と同じく、「all」は「分類を指定しない」ことを表す
  const categoryId = parsed.categoryId === "all" ? undefined : parsed.categoryId;

  const { fileName, data } = await masterService.exportMasterCsv({
    categoryId,
    keyword: parsed.keyword,
  });

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
});
