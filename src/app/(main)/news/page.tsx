import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";

// ページを毎回サーバー側で作り直す設定。
// 次の工程で追加する一覧を常に最新の状態で見せられるようにしておく。
export const dynamic = "force-dynamic";

// お知らせ管理画面（NEWS-02）の枠を表示する。
// お知らせの検索・一覧・登録操作は、後続の工程でこの画面へ追加する。
export default async function NewsPage() {
  // 未ログイン時は、画面のデータを取得する前にログイン画面へ移動させる。
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">お知らせ管理</h1>
    </div>
  );
}
