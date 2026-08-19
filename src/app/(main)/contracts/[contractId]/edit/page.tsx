import { notFound, redirect } from "next/navigation";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  ContractUpdateForm,
  contractService,
  parseContractReturnTo,
  type ContractStatus,
} from "@/modules/contract";
import { masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

/** 日付をinput type="date"が扱える「YYYY-MM-DD」形式の文字列にする。未定の場合は空文字列にする */
function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

// 契約更新画面（CTR-05）を表示する。
// ログインと更新権限を確認したうえで、更新前の内容と契約分類の一覧を入力フォームに渡す。
export default async function ContractEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ contractId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { contractId } = await params;
  const returnTo = parseContractReturnTo((await searchParams).returnTo);
  // 更新の権限が無い利用者がURLを直接開いた場合は、見るだけの詳細画面へ戻す
  if (!canWrite(user.role)) {
    redirect(`/contracts/${contractId}?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const contract = await contractService.findDetail(contractId);
  if (!contract) notFound();

  // 入力フォームの契約分類プルダウンに表示する選択肢
  const categoryOptions = await masterService.listMasterOptionsByCategoryCode(
    CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractUpdateForm
            contract={{
              id: contract.id,
              partyId: contract.partyId,
              partyName: contract.partyName,
              title: contract.title,
              startDate: toDateInputValue(contract.startDate),
              endDate: toDateInputValue(contract.endDate),
              status: contract.status as ContractStatus,
              categoryMasterId: contract.categoryMasterId,
              categoryLabel: contract.categoryLabel,
              updatedAt: contract.updatedAt.toISOString(),
            }}
            categoryOptions={categoryOptions}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
