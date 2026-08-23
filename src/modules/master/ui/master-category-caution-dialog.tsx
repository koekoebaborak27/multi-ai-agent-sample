"use client";

import { TriangleAlert } from "lucide-react";
import { useRef, useState, type RefObject } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

interface MasterCategoryCautionDialogProps {
  trigger: React.ReactNode;
  title: string;
  code: string;
  name: string;
  // 処理中（Server Action実行中）はキャンセル・Escapeキーによる中断を無視する。
  // 「編集する」ボタンのように処理を伴わない場合は省略してよい（既定値 false）。
  pending?: boolean;
  // footer（キャンセル・OK）は呼び出し側で組み立てる。
  // 「編集する」は画面遷移、「実行」はServer Actionの呼び出しとOKの動作が異なるため、
  // このコンポーネントでは組み立てない。キャンセルボタンには渡された cancelButtonRef を
  // 付けてもらい、初期フォーカスの制御と連携させる。
  children: (cancelButtonRef: RefObject<HTMLButtonElement | null>) => React.ReactNode;
}

// マスタ分類の「編集する」ボタンと、確認画面（更新モード）の「実行」ボタンで共用する警告確認ダイアログ。
// 契約先・契約モジュールがマスタ分類コードを直接参照しているため（§00.5.1）、
// 編集・削除には注意が必要である旨を、実際の処理を行う前にひとこと挟んで伝える。
// 操作自体を禁止するものではなく、footer側の「OK」を押せばそのまま処理を続行できる。
export function MasterCategoryCautionDialog({
  trigger,
  title,
  code,
  name,
  pending = false,
  children,
}: MasterCategoryCautionDialogProps) {
  const [open, setOpen] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        onOpenAutoFocus={(event) => {
          // 誤操作防止のため、既定のOKではなくキャンセルへ初期フォーカスを当てる
          event.preventDefault();
          cancelButtonRef.current?.focus();
        }}
      >
        <DialogHeader>
          <div className="mb-2 inline-flex size-16 items-center justify-center rounded-md bg-muted text-amber-600 dark:text-amber-400">
            <TriangleAlert />
          </div>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <dl className="grid gap-1 text-sm">
                <dt className="text-muted-foreground">マスタ分類コード</dt>
                <dd className="font-mono text-foreground">{code}</dd>
                <dt className="text-muted-foreground">マスタ分類名</dt>
                <dd className="break-words text-foreground">{name}</dd>
              </dl>
              <p className="text-sm text-amber-700 dark:text-amber-400">
                システムで利用されているコードのため、編集・削除には十分注意してください。
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>
        {children(cancelButtonRef)}
      </DialogContent>
    </Dialog>
  );
}
