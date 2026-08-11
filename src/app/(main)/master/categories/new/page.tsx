import { redirect } from "next/navigation";
import { MasterCategoryCreateForm } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// マスタ分類の新規登録画面を表示する。
// 入力フォーム自体は追加のデータを必要としないため、この画面ではログインと権限の確認だけを行う。
export default async function MasterCategoryNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // 登録の権限が無い利用者がURLを直接開いた場合は、分類一覧へ戻す
  if (!canWrite(user.role)) redirect("/master/categories");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ分類新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCategoryCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
