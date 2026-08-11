import { notFound, redirect } from "next/navigation";
import { MasterCategoryUpdateForm, masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// マスタ分類の更新画面を表示する。
// ログインと更新権限を確認したうえで、更新前の内容を入力フォームに渡す。
export default async function MasterCategoryEditPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // URLの分類指定は文字列なので数値に変換する。数値でない値が入っていれば「見つからない」扱いにする
  const { categoryId } = await params;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  // 更新の権限が無い利用者がURLを直接開いた場合は、見るだけの詳細画面へ戻す
  if (!canWrite(user.role)) redirect(`/master/categories/${id}`);

  const category = await masterService.findCategoryDetail(id);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ分類更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCategoryUpdateForm
            category={{
              id: category.id,
              code: category.code,
              name: category.name,
              masterCount: category.masterCount,
              updatedAt: category.updatedAt.toISOString(),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
