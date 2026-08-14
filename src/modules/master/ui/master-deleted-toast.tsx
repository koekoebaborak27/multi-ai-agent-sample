"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { MESSAGES } from "@/shared/constants/messages";
import { toast } from "@/shared/ui/toaster";

// マスタ削除の直後、一覧画面のURLに付く deleted=1 という印を見つけて、削除完了のトーストを出す。
// 表示したあとはURLからこの印だけを取り除く。検索条件には含めていないため、
// 取り除いてもページ番号や絞り込み条件はそのまま残る。
export function MasterDeletedToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("deleted") !== "1") return;
    toast.success(MESSAGES.common.deleted);

    const next = new URLSearchParams(searchParams);
    next.delete("deleted");
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  return null;
}
