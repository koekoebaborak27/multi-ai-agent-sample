import { notFound, redirect } from "next/navigation";
import { MasterDetailView, masterService, parseMasterReturnTo } from "@/modules/master";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";

export default async function MasterDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ masterId: string }>;
  searchParams: Promise<{ created?: string; updated?: string; returnTo?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { masterId } = await params;
  const id = Number(masterId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const master = await masterService.findMasterDetail(id);
  if (!master) notFound();

  const { created, updated, returnTo } = await searchParams;
  const successMessage =
    created === "1" ? "登録しました" : updated === "1" ? "更新しました" : undefined;

  return (
    <MasterDetailView
      master={master}
      returnTo={parseMasterReturnTo(returnTo)}
      canWrite={canWrite(user.role)}
      successMessage={successMessage}
    />
  );
}
