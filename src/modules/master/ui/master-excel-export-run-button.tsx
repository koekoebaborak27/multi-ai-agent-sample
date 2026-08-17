"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { requestMasterExcelExportAction } from "@/modules/master/actions";
import { MESSAGES } from "@/shared/constants/messages";
import { Button } from "@/shared/ui/button";
import { toast } from "@/shared/ui/toaster";

// マスタ情報Excel取得（MST-11）の「Excelを作成する」ボタン。
// 押すと依頼だけを登録し、生成が終わるのを待たずにすぐ応答する（設計書§40.3.4）。
// 一覧側の実行中件数は見ないため、他に実行中の依頼があっても新規の依頼をブロックしない。
// 二重押下防止は「このクリックの処理中」だけをdisabledにすることで満たす。
export function MasterExcelExportRunButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const result = await requestMasterExcelExportAction();
        if ("error" in result) {
          toast.error(result.error);
          return;
        }
        // 受付済みの行を一覧の先頭に出すため、最新の状態を取り直す
        router.refresh();
      } catch {
        toast.error(MESSAGES.common.unexpected);
      }
    });
  };

  return (
    <Button onClick={handleClick} disabled={isPending}>
      {isPending ? "受付中..." : "Excelを作成する"}
    </Button>
  );
}
