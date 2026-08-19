import { notFound, redirect } from "next/navigation";
import {
  PARTY_COMPANY_TYPE_CATEGORY_CODE,
  PartyUpdateForm,
  parsePartyReturnTo,
  partyService,
} from "@/modules/party";
import { masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 契約先更新画面（PTY-05）を表示する。
// ログインと更新権限を確認したうえで、更新前の内容と契約先分類の一覧を入力フォームに渡す。
export default async function PartyEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ partyId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { partyId } = await params;
  const returnTo = parsePartyReturnTo((await searchParams).returnTo);
  // 更新の権限が無い利用者がURLを直接開いた場合は、見るだけの詳細画面へ戻す
  if (!canWrite(user.role))
    redirect(`/parties/${partyId}?returnTo=${encodeURIComponent(returnTo)}`);

  const party = await partyService.findDetail(partyId);
  if (!party) notFound();

  // 入力フォームの分類プルダウンに表示する選択肢
  const companyTypeOptions = await masterService.listMasterOptionsByCategoryCode(
    PARTY_COMPANY_TYPE_CATEGORY_CODE,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約先更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <PartyUpdateForm
            party={{
              id: party.id,
              name: party.name,
              companyTypeMasterId: party.companyTypeMasterId,
              companyTypeLabel: party.companyTypeLabel,
              contactInfo: party.contactInfo,
              updatedAt: party.updatedAt.toISOString(),
            }}
            companyTypeOptions={companyTypeOptions}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
