import { redirect } from "next/navigation";
import { MasterCreateForm, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// マスタ新規登録画面を表示する。
// ログインと登録権限を確認したうえで、入力フォームに必要な分類の一覧を渡す。
export default async function MasterNewPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 一覧から渡された戻り先URL。キャンセル時と登録後の遷移で使う
  const returnTo = parseMasterReturnTo((await searchParams).returnTo);
  // 登録の権限が無い利用者がURLを直接開いた場合は、元の一覧へ戻す
  if (!canWrite(user.role)) redirect(returnTo);

  // 入力フォームの分類プルダウンに表示する選択肢
  const categories = await masterService.listCategoryOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCreateForm categories={categories} returnTo={returnTo} />
        </CardContent>
      </Card>
    </div>
  );
}
