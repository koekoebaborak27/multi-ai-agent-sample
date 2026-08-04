import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { Sidebar } from "@/shared/layout/sidebar";
import { Header } from "@/shared/layout/header";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // proxy でもガードするが、二重に保護する
  if (!user) redirect("/login");

  // 初回パスワード変更が未了の間は、proxy が他画面への遷移をすべて /settings/password へ戻す。
  // サイドバーやヘッダーを出しても押せるリンクが無いため、ログイン画面と同じ
  // 中央寄せの単独画面として見せる。
  if (user.mustChangePassword) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
        <div className="w-full max-w-md">{children}</div>
      </main>
    );
  }

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
