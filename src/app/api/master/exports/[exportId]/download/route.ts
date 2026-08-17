import { masterService, MASTER_EXCEL_EXPORT_CONTENT_TYPE } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { Errors } from "@/shared/errors/app-error";
import { withRoute } from "@/shared/observability/with-route";

// データベースへ接続するため、動作環境を固定し、毎回その場で確認するようにする
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * マスタ情報Excel取得（MST-11）の履歴一覧からのダウンロードの窓口。
 * 保存先（Supabase Storageまたはローカル）に既に置いてあるファイルを読み出し、
 * その場でレスポンスとして返す（署名URLは使わず、アプリ経由で統一する。設計書§40.9）。
 *
 * ログインしていることだけを確認し、ロール（ADMIN/OPERATOR/VIEWER）による制限は行わない。
 * CSVダウンロードと異なり、Excel取得は他の利用者が作ったファイルも含めて
 * 全ロールがダウンロードできる仕様のため（設計書§40.4）。
 */
export const GET = withRoute(
  "master.excel-export.download",
  async (req: Request, ctx?: unknown) => {
    const user = await getCurrentUser();
    if (!user) throw Errors.unauthorized();

    // withRouteの型が汎用（ctx: unknown）のため、このRoute Handler固有の形をここで明示する。
    // Next.jsの動的URLパラメータは「あとから届く値」（Promise）として渡ってくる。
    const { exportId } = await (ctx as { params: Promise<{ exportId: string }> }).params;

    const { fileName, data } = await masterService.getExcelExportDownload(exportId);

    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MASTER_EXCEL_EXPORT_CONTENT_TYPE,
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  },
);
