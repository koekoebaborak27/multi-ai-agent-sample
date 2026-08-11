import { notFound, redirect } from "next/navigation";
import { MasterUpdateForm, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// マスタ更新画面を表示する。
// ログインと更新権限を確認したうえで、更新前の内容と分類の一覧を入力フォームに渡す。
export default async function MasterEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // URLのマスタ指定は文字列なので数値に変換する。数値でない値が入っていれば「見つからない」扱いにする
  const { masterId } = await params;
  const id = Number(masterId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const returnTo = parseMasterReturnTo((await searchParams).returnTo);
  // 更新の権限が無い利用者がURLを直接開いた場合は、見るだけの詳細画面へ戻す
  if (!canWrite(user.role)) redirect(`/master/${id}?returnTo=${encodeURIComponent(returnTo)}`);

  const master = await masterService.findMasterDetail(id);
  if (!master) notFound();

  // 入力フォームの分類プルダウンに表示する選択肢
  const categories = await masterService.listCategoryOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterUpdateForm
            master={{
              id: master.id,
              categoryId: master.categoryId,
              categoryName: master.categoryName,
              code: master.code,
              content: master.content,
              updatedAt: master.updatedAt.toISOString(),
            }}
            categories={categories}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
