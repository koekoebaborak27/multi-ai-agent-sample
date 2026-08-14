import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/shared/ui/toaster";

export const metadata: Metadata = {
  title: "サンプル契約管理システム",
  description: "サンプル契約管理システム",
};

// すべての画面の一番外側の枠。
// 各画面はこの中に差し込まれて表示される。
// お知らせの表示場所もここに置き、どの画面からでも使えるようにしている。
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
