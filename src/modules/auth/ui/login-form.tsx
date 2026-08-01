"use client";

import { useState, useActionState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { loginWithCredentials, loginWithEntra, type FormState } from "@/modules/auth/actions";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: FormState = {};

export function LoginForm({ entraEnabled }: { entraEnabled: boolean }) {
  const [state, formAction, pending] = useActionState(loginWithCredentials, initialState);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-6">
      {entraEnabled && (
        <form action={loginWithEntra}>
          <Button type="submit" variant="outline" className="w-full">
            Microsoft Entra ID でログイン
          </Button>
        </form>
      )}

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
          <Input id="userId" name="userId" autoComplete="username" maxLength={7} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="pr-9"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute inset-y-0 right-0 h-full w-9 text-muted-foreground hover:bg-transparent"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "パスワードを非表示にする" : "パスワードを表示する"}
            >
              {showPassword ? <EyeOff /> : <Eye />}
            </Button>
          </div>
        </div>
        {state.error && (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "ログイン中..." : "ログイン"}
        </Button>
      </form>
    </div>
  );
}
