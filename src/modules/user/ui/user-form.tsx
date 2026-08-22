"use client";

import { useActionState, useEffect, useRef } from "react";
import { createUserAction, type UserFormState } from "@/modules/user/actions";
import { ALL_ROLES } from "@/shared/constants/roles";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: UserFormState = {};

// 利用者の新規登録フォーム（管理者向け画面）。
// 一覧画面の中に置かれ、登録すると同じ画面のまま一覧へ反映される。
export function UserForm() {
  const [state, formAction, pending] = useActionState(createUserAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 登録に成功したら入力欄を空に戻す。続けて別の利用者を登録しやすくするため。
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="userId">ユーザーID</Label>
        <Input id="userId" name="userId" maxLength={64} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="displayName">表示名</Label>
        <Input id="displayName" name="displayName" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">メール</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">ロール</Label>
        <select
          id="role"
          name="role"
          defaultValue="VIEWER"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="password">
          初期パスワード（任意・8文字以上。設定すると初回変更を強制）
        </Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 md:col-span-2">ユーザーを作成しました</p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "作成中..." : "ユーザーを作成"}
        </Button>
      </div>
    </form>
  );
}
