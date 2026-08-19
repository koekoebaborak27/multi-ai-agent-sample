import { redirect } from "next/navigation";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  ContractCreateForm,
  parseContractReturnTo,
} from "@/modules/contract";
import { masterService } from "@/modules/master";
import { partyService } from "@/modules/party";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { env } from "@/shared/config/env";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 契約新規登録画面（CTR-02）を表示する。
// ログインと登録権限を確認したうえで、入力フォームに必要な契約先・契約分類の一覧を渡す。
export default async function ContractNewPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  // 一覧から渡された戻り先URL。キャンセル時と登録後の遷移で使う
  const returnTo = parseContractReturnTo((await searchParams).returnTo);
  // 登録の権限が無い利用者がURLを直接開いた場合は、元の一覧へ戻す
  if (!canWrite(user.role)) redirect(returnTo);

  // 契約先コンボボックスの選択肢用に、登録済みの契約先を全件取得する（クライアント側で絞り込む。§00.9.2）
  const [partyList, categoryOptions] = await Promise.all([
    partyService.list({}, 1, env.PAGE_SIZE),
    masterService.listMasterOptionsByCategoryCode(CONTRACT_CATEGORY_MASTER_CATEGORY_CODE),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">契約新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <ContractCreateForm
            partyOptions={partyList.items.map((p) => ({ id: p.id, name: p.name }))}
            categoryOptions={categoryOptions}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
