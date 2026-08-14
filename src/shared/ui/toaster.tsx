"use client";

import { Toaster as SonnerToaster } from "sonner";

/**
 * 画面の隅に一時的なお知らせを出すための置き場所。
 * どの画面からでも出せるよう、全画面の土台となるファイルに1つだけ置いている。
 */
export function Toaster() {
  return <SonnerToaster richColors position="top-right" />;
}

export { toast } from "sonner";
