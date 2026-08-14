"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

/**
 * パスワードの入力欄。右端の目のボタンで、入力内容を隠す・見せるを切り替えられる。
 * ログイン画面とパスワード変更画面の両方で使うため、共通の部品として置いている。
 *
 * 入力欄の種類は隠す・見せるの切り替えに使っているため、外から指定できないようにしている。
 */
export function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-9", className)} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="absolute inset-y-0 right-0 h-full w-9 text-muted-foreground hover:bg-transparent"
        onClick={() => setVisible((prev) => !prev)}
        aria-label={visible ? "パスワードを非表示にする" : "パスワードを表示する"}
      >
        {visible ? <EyeOff /> : <Eye />}
      </Button>
    </div>
  );
}
