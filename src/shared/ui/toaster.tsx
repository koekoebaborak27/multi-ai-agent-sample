"use client";

import { Toaster as SonnerToaster } from "sonner";

/** アプリ全体のトースト表示（ルートレイアウトに配置） */
export function Toaster() {
  return <SonnerToaster richColors position="top-right" />;
}

export { toast } from "sonner";
