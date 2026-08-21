"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  requestPasswordResetAction,
  type ForgotPasswordFormState,
} from "@/modules/password-reset/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: ForgotPasswordFormState = {};

// ログイン画面へ戻る、控えめな文字リンク
function BackToLoginLink() {
  return (
    <Link
      href="/login"
      className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
    >
      ログイン画面へ戻る
    </Link>
  );
}

// パスワード再発行の申請フォーム（PWR-01）。
// 送信後は入力欄を消し、受付完了の文言だけを表示する（何度も押せないようにするため）。
// 登録の有無にかかわらず同じ文言を出すため、送信結果からは何も読み取れない。
export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  if (state.submitted) {
    return (
      <div className="space-y-4">
        <p className="text-sm">
          入力されたメールアドレスが登録されている場合、再設定用のURLをお送りしました。メールをご確認ください。
        </p>
        <BackToLoginLink />
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-sm text-muted-foreground">
        登録されているメールアドレスを入力してください。パスワードを再設定するためのURLをお送りします。
      </p>
      <div className="space-y-2">
        <Label htmlFor="email">メールアドレス</Label>
        <Input id="email" name="email" type="email" autoComplete="email" maxLength={254} required />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "送信中..." : "再設定用のURLを送る"}
      </Button>
      <BackToLoginLink />
    </form>
  );
}
