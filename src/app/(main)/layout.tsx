import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { Sidebar } from "@/shared/layout/sidebar";
import { Header } from "@/shared/layout/header";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // proxy でもガードするが、二重に保護する
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={user.role} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header displayName={user.displayName ?? user.id} role={user.role} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
