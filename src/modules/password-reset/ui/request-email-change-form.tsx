"use client";

import { useActionState } from "react";
import {
  requestEmailChangeAction,
  type RequestEmailChangeFormState,
} from "@/modules/password-reset/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: RequestEmailChangeFormState = {};

// メールアドレス変更申し込みフォーム（EML-01）。
// 現在のメールアドレスは変更できない項目として表示し、新しいアドレスの入力欄だけを操作させる。
// 送信後は入力欄を消し、確認メールを送った旨だけを表示する（何度も押せないようにするため）。
export function RequestEmailChangeForm({ currentEmail }: { currentEmail: string | null }) {
  const [state, formAction, pending] = useActionState(requestEmailChangeAction, initialState);

  if (state.submitted) {
    return (
      <p className="text-sm">
        入力されたアドレスに確認用のURLをお送りしました。URLを開くと変更が完了します。
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label>現在のメールアドレス</Label>
        <p className="text-sm text-muted-foreground">{currentEmail ?? "未登録"}</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="newEmail">新しいメールアドレス</Label>
        <Input
          id="newEmail"
          name="newEmail"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "送信中..." : "確認メールを送る"}
      </Button>
    </form>
  );
}
