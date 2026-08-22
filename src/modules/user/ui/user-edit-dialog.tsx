"use client";

import { useActionState, useState } from "react";
import { updateUserAction, type UserFormState } from "@/modules/user/actions";
import type { UserSummary } from "@/modules/user/types";
import { ALL_ROLES } from "@/shared/constants/roles";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: UserFormState = {};

interface UserEditDialogProps {
  user: UserSummary;
}

// 利用者一覧の「編集」ボタンと、その編集ダイアログ（管理者向け画面）。
// 変更できるのは表示名・メールアドレス・役割のみで、ユーザーIDとパスワードはここでは変更できない。
export function UserEditDialog({ user }: UserEditDialogProps) {
  const [state, formAction, pending] = useActionState(updateUserAction, initialState);
  const [open, setOpen] = useState(false);
  // 更新成功をすでにダイアログを閉じる処理へ反映したかどうかを、状態そのものの同一性で覚えておく。
  // 同じ state を指している間は繰り返し閉じ処理をしない（レンダー中に state を調整する定石）。
  const [closedForState, setClosedForState] = useState<UserFormState | null>(null);
  if (state.success && closedForState !== state) {
    setClosedForState(state);
    setOpen(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 保存の実行中は、キャンセルやEscapeキーによる中断を無視する
        if (pending) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          編集
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ユーザーを編集</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="userId" value={user.userId} />
          <div className="space-y-2">
            <Label htmlFor={`edit-displayName-${user.userId}`}>表示名</Label>
            <Input
              id={`edit-displayName-${user.userId}`}
              name="displayName"
              defaultValue={user.displayName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-email-${user.userId}`}>メール</Label>
            <Input
              id={`edit-email-${user.userId}`}
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-role-${user.userId}`}>ロール</Label>
            <select
              id={`edit-role-${user.userId}`}
              name="role"
              defaultValue={user.role}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          {state.error && (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "保存中..." : "保存する"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
