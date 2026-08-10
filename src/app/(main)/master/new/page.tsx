import { redirect } from "next/navigation";
import { MasterCreateForm, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function MasterNewPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const returnTo = parseMasterReturnTo((await searchParams).returnTo);
  if (!canWrite(user.role)) redirect(returnTo);

  const categories = await masterService.listCategoryOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCreateForm categories={categories} returnTo={returnTo} />
        </CardContent>
      </Card>
    </div>
  );
}
