import { notFound, redirect } from "next/navigation";
import { ContractDetailView, contractService, parseContractReturnTo } from "@/modules/contract";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";

// 契約詳細画面（CTR-04）を表示する。
// URLで指定された契約を取得して表示するほか、登録・更新の直後にもこの画面へ移動してくるため、
// その場合は完了メッセージも表示する。
export default async function ContractDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ created?: string; updated?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { contractId } = await params;
  const contract = await contractService.findDetail(contractId);
  if (!contract) notFound();

  // 登録・更新の直後は、移動元がURLに印を付けてくるので、それに応じた完了メッセージを出す
  const { created, updated, returnTo } = await searchParams;
  const successMessage =
    created === "1" ? "登録しました" : updated === "1" ? "更新しました" : undefined;

  return (
    <ContractDetailView
      contract={contract}
      returnTo={parseContractReturnTo(returnTo)}
      canWrite={canWrite(user.role)}
      successMessage={successMessage}
    />
  );
}
