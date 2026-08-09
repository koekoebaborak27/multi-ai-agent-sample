import { notFound, redirect } from "next/navigation";
import { MasterCategoryDetailView, masterService } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";

export default async function MasterCategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categoryId: string }>;
  searchParams: Promise<{ created?: string; updated?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { categoryId } = await params;
  const id = Number(categoryId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const category = await masterService.findCategoryDetail(id);
  if (!category) notFound();

  const { created, updated } = await searchParams;
  const successMessage =
    created === "1" ? "登録しました" : updated === "1" ? "更新しました" : undefined;

  return (
    <MasterCategoryDetailView
      category={category}
      canWrite={canWrite(user.role)}
      successMessage={successMessage}
    />
  );
}
