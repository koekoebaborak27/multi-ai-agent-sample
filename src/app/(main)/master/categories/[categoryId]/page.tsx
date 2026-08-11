import { notFound, redirect } from "next/navigation";
import { MasterCategoryDetailView, masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";

// マスタ分類詳細画面を表示する。
// URLで指定された分類を取得して表示するほか、登録・更新の直後にもこの画面へ移動してくるため、
// その場合は完了メッセージも表示する。
export default async function MasterCategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // URLの分類指定は文字列なので数値に変換する。数値でない値が入っていれば「見つからない」扱いにする
  const { categoryId } = await params;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const category = await masterService.findCategoryDetail(id);
  if (!category) notFound();

  // 登録・更新の直後は、移動元がURLに印を付けてくるので、それに応じた完了メッセージを出す
  const { created, updated } = await searchParams;
  const successMessage =
    created === "1" ? "登録しました" : updated === "1" ? "更新しました" : undefined;

  return (
    <MasterCategoryDetailView
      category={category}
      canWrite={canWrite(user.role)}
      successMessage={successMessage}
    />
  );
}
