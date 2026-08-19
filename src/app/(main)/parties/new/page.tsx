import { redirect } from "next/navigation";
import {
  PARTY_COMPANY_TYPE_CATEGORY_CODE,
  PartyCreateForm,
  parsePartyReturnTo,
} from "@/modules/party";
import { masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 契約先新規登録画面（PTY-02）を表示する。
// ログインと登録権限を確認したうえで、入力フォームに必要な契約先分類の一覧を渡す。
export default async function PartyNewPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 一覧から渡された戻り先URL。キャンセル時と登録後の遷移で使う
  const returnTo = parsePartyReturnTo((await searchParams).returnTo);
  // 登録の権限が無い利用者がURLを直接開いた場合は、元の一覧へ戻す
  if (!canWrite(user.role)) redirect(returnTo);

  // 入力フォームの分類プルダウンに表示する選択肢
  const companyTypeOptions = await masterService.listMasterOptionsByCategoryCode(
    PARTY_COMPANY_TYPE_CATEGORY_CODE,
  );

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約先新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <PartyCreateForm companyTypeOptions={companyTypeOptions} returnTo={returnTo} />
        </CardContent>
      </Card>
    </div>
  );
}
