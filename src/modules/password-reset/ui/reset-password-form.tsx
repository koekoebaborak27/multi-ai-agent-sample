"use client";

import { useActionState } from "react";
import { resetPasswordAction, type ResetPasswordFormState } from "@/modules/password-reset/actions";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { PasswordInput } from "@/shared/ui/password-input";

const initialState: ResetPasswordFormState = {};

// パスワード再設定フォーム(PWR-02)。
// 合言葉(token)はURLの一部でしかなく画面には出さないため、隠しフィールドで送信する。
export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(resetPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
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
        {pending ? "設定中..." : "設定する"}
      </Button>
    </form>
  );
}
