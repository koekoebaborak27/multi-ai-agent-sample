import { notFound, redirect } from "next/navigation";
import { MasterCategoryUpdateForm, masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function MasterCategoryEditPage({
  params,
}: {
  params: Promise<{ categoryId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { categoryId } = await params;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  if (!canWrite(user.role)) redirect(`/master/categories/${id}`);

  const category = await masterService.findCategoryDetail(id);
  if (!category) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ分類更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterCategoryUpdateForm
            category={{
              id: category.id,
              code: category.code,
              name: category.name,
              masterCount: category.masterCount,
              updatedAt: category.updatedAt.toISOString(),
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
