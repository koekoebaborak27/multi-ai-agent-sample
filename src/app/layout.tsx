import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/shared/ui/toaster";

export const metadata: Metadata = {
  title: "サンプル契約管理システム",
  description: "サンプル契約管理システム",
};

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
