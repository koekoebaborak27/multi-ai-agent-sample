"use client";

import Link from "next/link";
import { MasterCategoryCautionDialog } from "@/modules/master/ui/master-category-caution-dialog";
import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";

interface MasterCategoryEditDialogProps {
  categoryId: number;
  code: string;
  name: string;
}

// マスタ分類詳細画面の「編集する」ボタンと、その警告確認ダイアログ（§00.5.1）。
// OKを押すとマスタ分類更新画面へ遷移するだけで、この時点ではServer Actionを呼ばない。
export function MasterCategoryEditDialog({
  categoryId,
  code,
  name,
}: MasterCategoryEditDialogProps) {
  return (
    <MasterCategoryCautionDialog
      trigger={<Button>編集する</Button>}
      title="マスタ分類を編集しますか？"
      code={code}
      name={name}
    >
      {(cancelButtonRef) => (
        <DialogFooter>
          <DialogClose asChild>
            <Button ref={cancelButtonRef} variant="outline">
              キャンセル
            </Button>
          </DialogClose>
          <Button asChild>
            <Link href={`/master/categories/${categoryId}/edit`}>OK</Link>
          </Button>
        </DialogFooter>
      )}
    </MasterCategoryCautionDialog>
  );
}
