import { notFound, redirect } from "next/navigation";
import { MasterDetailView, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";

// マスタ詳細画面を表示する。
// URLで指定されたマスタを取得して表示するほか、登録・更新の直後にもこの画面へ移動してくるため、
// その場合は完了メッセージも表示する。
export default async function MasterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ created?: string; updated?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // URLのマスタ指定は文字列なので数値に変換する。数値でない値が入っていれば「見つからない」扱いにする
  const { masterId } = await params;
  const id = Number(masterId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const master = await masterService.findMasterDetail(id);
  if (!master) notFound();

  // 登録・更新の直後は、移動元がURLに印を付けてくるので、それに応じた完了メッセージを出す
  const { created, updated, returnTo } = await searchParams;
  const successMessage =
    created === "1" ? "登録しました" : updated === "1" ? "更新しました" : undefined;

  return (
    <MasterDetailView
      master={master}
      returnTo={parseMasterReturnTo(returnTo)}
      canWrite={canWrite(user.role)}
      successMessage={successMessage}
    />
  );
}
