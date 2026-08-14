"use client";

import { useActionState } from "react";
import { changePassword, type FormState } from "@/modules/auth/actions";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { PasswordInput } from "@/shared/ui/password-input";

const initialState: FormState = {};

// パスワード変更フォーム。
// 自分で変更する場合と、初回ログイン時に変更を求められた場合の両方で使う。
// 入力の誤りは、変更処理から返ってきたメッセージをそのまま表示する。
export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">現在のパスワード</Label>
        <PasswordInput
          id="currentPassword"
          name="currentPassword"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="newPassword">新しいパスワード</Label>
        <PasswordInput id="newPassword" name="newPassword" autoComplete="new-password" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">新しいパスワード（確認）</Label>
        <PasswordInput
          id="confirmPassword"
          name="confirmPassword"
          autoComplete="new-password"
          required
        />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "変更中..." : "パスワードを変更"}
      </Button>
    </form>
  );
}
