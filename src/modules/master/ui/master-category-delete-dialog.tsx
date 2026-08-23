"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import {
  deleteMasterCategoryAction,
  type DeleteMasterCategoryFormState,
} from "@/modules/master/actions";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";

interface MasterCategoryDeleteDialogProps {
  categoryId: number;
  code: string;
  name: string;
  updatedAt: string;
}

// マスタ分類詳細画面の「削除」ボタンと、その確認ダイアログ。
// 配下にマスタが残っている場合は削除できないため、その旨のエラーメッセージをダイアログ内に表示する
// （ボタン自体は押せる状態にしておき、押した結果としてエラーを見せる。設計書 §6.8.3）。
export function MasterCategoryDeleteDialog({
  categoryId,
  code,
  name,
  updatedAt,
}: MasterCategoryDeleteDialogProps) {
  const initialState: DeleteMasterCategoryFormState = {
    categoryId,
    code,
    name,
    updatedAt,
  };
  const [state, formAction, pending] = useActionState(deleteMasterCategoryAction, initialState);
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        // 削除処理の実行中は、キャンセルやEscapeキーによる中断を無視する
        if (pending) return;
        setOpen(next);
      }}
    >
      <Button variant="destructive" onClick={() => setOpen(true)}>
        削除
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>マスタ分類を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <dl className="grid gap-1 text-sm">
                <dt className="text-muted-foreground">マスタ分類コード</dt>
                <dd className="font-mono text-foreground">{code}</dd>
                <dt className="text-muted-foreground">マスタ分類名</dt>
                <dd className="break-words text-foreground">{name}</dd>
              </dl>
              <p className="text-sm text-destructive">削除したマスタ分類は元に戻せません。</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                システムで利用されているコードのため、編集・削除には十分注意してください。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="categoryId" value={categoryId} />
          <input type="hidden" name="updatedAt" value={updatedAt} />
          {state.error ? (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            {/*
              AlertDialogAction はクリック時にダイアログを自動で閉じる動作を持つため使わない。
              削除処理中はダイアログを閉じられないようにしたいので、素のボタンにして
              閉じる操作は onOpenChange 側の pending チェックだけに任せる。
            */}
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "削除中..." : "削除する"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
