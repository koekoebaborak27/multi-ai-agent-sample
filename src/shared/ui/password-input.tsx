"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/ui/utils";

/**
 * パスワード入力欄。右端の目のアイコンで表示 / 非表示を切り替える。
 * ログインとパスワード変更の双方で使うため shared に置く。
 * type は内部で制御するため props から受け取らない。
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
