import { redirect } from "next/navigation";
import { MasterCategoryCreateForm } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function MasterCategoryNewPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!canWrite(user.role)) redirect("/master/categories");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ分類新規登録</h1>
      <Card>
        <CardHeader>
          <CardTitle>登録内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCategoryCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
