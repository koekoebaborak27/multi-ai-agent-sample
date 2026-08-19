"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { deletePartyAction, type DeletePartyFormState } from "@/modules/party/actions";
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

interface PartyDeleteDialogProps {
  partyId: string;
  name: string;
  companyTypeLabel: string;
  updatedAt: string;
  returnTo: string;
}

// 契約先詳細画面の「削除」ボタンと、その確認ダイアログ（§14.2）。
// ダイアログを開く際はサーバーへ問い合わせず、詳細画面がすでに持っている値だけを表示に使う。
// 削除処理の実行中はダイアログを閉じられないようにし、二重送信も防ぐ（マスタ削除と同じ実装方針）。
export function PartyDeleteDialog({
  partyId,
  name,
  companyTypeLabel,
  updatedAt,
  returnTo,
}: PartyDeleteDialogProps) {
  const initialState: DeletePartyFormState = {
    id: partyId,
    name,
    companyTypeLabel,
    updatedAt,
    returnTo,
  };
  const [state, formAction, pending] = useActionState(deletePartyAction, initialState);
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
          <AlertDialogTitle>契約先を削除しますか？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <dl className="grid gap-1 text-sm">
                <dt className="text-muted-foreground">名称</dt>
                <dd className="break-words text-foreground">{name}</dd>
                <dt className="text-muted-foreground">分類</dt>
                <dd className="break-words text-foreground">{companyTypeLabel}</dd>
              </dl>
              <p className="text-sm text-destructive">
                削除した契約先は元に戻せません。
                <br />
                紐づく契約が1件でも存在する場合は削除できません。
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="id" value={partyId} />
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
              AlertDialogActionはクリック時にダイアログを自動で閉じる動作を持つため使わない。
              削除処理中はダイアログを閉じられないようにしたいので、素のボタンにして
              閉じる操作はonOpenChange側のpendingチェックだけに任せる。
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
