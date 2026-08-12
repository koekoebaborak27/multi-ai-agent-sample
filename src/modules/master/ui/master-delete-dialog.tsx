"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { deleteMasterAction, type DeleteMasterFormState } from "@/modules/master/actions";
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

interface MasterDeleteDialogProps {
  masterId: number;
  categoryName: string;
  code: string;
  content: string;
  updatedAt: string;
  returnTo: string;
}

// マスタ詳細画面の「削除」ボタンと、その確認ダイアログ。
// ダイアログを開く際はサーバーへ問い合わせず、詳細画面がすでに持っている値だけを表示に使う。
// 削除処理の実行中はダイアログを閉じられないようにし、二重送信も防ぐ。
export function MasterDeleteDialog({
  masterId,
  categoryName,
  code,
  content,
  updatedAt,
  returnTo,
}: MasterDeleteDialogProps) {
  const initialState: DeleteMasterFormState = {
    masterId,
    categoryName,
    code,
    content,
    updatedAt,
    returnTo,
  };
  const [state, formAction, pending] = useActionState(deleteMasterAction, initialState);
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
        削除する
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>マスタを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <dl className="grid gap-1 text-sm">
                <dt className="text-muted-foreground">マスタ分類</dt>
                <dd className="break-words text-foreground">{categoryName}</dd>
                <dt className="text-muted-foreground">マスタコード</dt>
                <dd className="font-mono text-foreground">{code}</dd>
                <dt className="text-muted-foreground">マスタ内容</dt>
                <dd className="break-words text-foreground">{content}</dd>
              </dl>
              <p className="text-sm text-destructive">
                削除したマスタは元に戻せません。
                <br />
                このマスタを参照している画面では「未設定」として表示されます。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="masterId" value={masterId} />
          <input type="hidden" name="updatedAt" value={updatedAt} />
          <input type="hidden" name="returnTo" value={returnTo} />
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
