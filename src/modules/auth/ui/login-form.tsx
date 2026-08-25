"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginWithCredentials, loginWithEntra, type FormState } from "@/modules/auth/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PasswordInput } from "@/shared/ui/password-input";

const initialState: FormState = {};

// ログインフォーム。
// ID とパスワードによるログインは常に表示し、Microsoft アカウントによるログインは
// この案件で使う設定になっている場合（entraEnabled）だけ表示する。
export function LoginForm({ entraEnabled }: { entraEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(loginWithCredentials, initialState);

  return (
    <div className="space-y-6">
      {entraEnabled && (
        <form action={loginWithEntra}>
          <Button type="submit" variant="outline" className="w-full">
            Microsoft Entra ID でログイン
          </Button>
        </form>
      )}

      {/* 2 つのログイン方法を並べるときだけ、間に「または」の区切りを表示する */}
      {entraEnabled && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">または</span>
          </div>
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="userId">ユーザーID</Label>
          <Input id="userId" name="userId" autoComplete="username" maxLength={64} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <PasswordInput id="password" name="password" autoComplete="current-password" required />
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "ログイン中..." : "ログイン"}
        </Button>
        <Link
          href="/forgot-password"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          パスワードを忘れた場合はこちら
        </Link>
        <Link
          href="/about"
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          システム紹介
        </Link>
      </form>
    </div>
  );
}
