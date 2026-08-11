import { notFound, redirect } from "next/navigation";
import { MasterUpdateForm, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export default async function MasterEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { masterId } = await params;
  const id = Number(masterId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const returnTo = parseMasterReturnTo((await searchParams).returnTo);
  if (!canWrite(user.role)) redirect(`/master/${id}?returnTo=${encodeURIComponent(returnTo)}`);

  const master = await masterService.findMasterDetail(id);
  if (!master) notFound();

  const categories = await masterService.listCategoryOptions();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">マスタ更新</h1>
      <Card>
        <CardHeader>
          <CardTitle>更新内容</CardTitle>
        </CardHeader>
        <CardContent>
          <MasterUpdateForm
            master={{
              id: master.id,
              categoryId: master.categoryId,
              categoryName: master.categoryName,
              code: master.code,
              content: master.content,
              updatedAt: master.updatedAt.toISOString(),
            }}
            categories={categories}
            returnTo={returnTo}
          />
        </CardContent>
      </Card>
    </div>
  );
}
