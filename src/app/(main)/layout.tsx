import { redirect } from "next/navigation";
import { getCurrentUser } from "@/shared/auth/session";
import { Sidebar } from "@/shared/layout/sidebar";
import { Header } from "@/shared/layout/header";

// ログイン後の画面すべてに共通する枠。左のメニューと上の帯を表示し、その中に各画面を差し込む。
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  // src/proxy.ts でも確認しているが、万一そこを通らなかった場合に備えて二重に確認する
  if (!user) redirect("/login");

  // 初回パスワード変更が終わるまでは、src/proxy.ts が他の画面への移動をすべて止めるため、
  // メニューを出しても押せる項目が無い。
  // そのため、この間はログイン画面と同じように、中央に寄せた単独の画面として見せる。
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
