"use client";

import { useState } from "react";
import { ChevronDown, User } from "lucide-react";
import { PasswordChangeForm } from "@/modules/auth/ui/password-change-form";
import { signOutAction } from "@/modules/auth/actions";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

// 画面右上の利用者メニュー。パスワード変更とログアウトを行える。
// パスワード変更は画面を移動せず、その場に小窓を開いて入力してもらう。
export function UserMenu() {
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" aria-label="ユーザーメニュー" className="gap-1 px-1.5">
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <User className="size-4" />
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {/*
            選んだときの既定の動き（メニューを閉じる）を止めてから小窓を開く。
            止めないと、メニューが閉じる動きと小窓が開く動きが重なり、小窓が正しく開かないため。
          */}
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              setPasswordDialogOpen(true);
            }}
          >
            パスワード変更
          </DropdownMenuItem>
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              void signOutAction();
            }}
          >
            ログアウト
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>パスワードの変更</DialogTitle>
            <DialogDescription>
              現在のパスワードと新しいパスワードを入力してください。
            </DialogDescription>
          </DialogHeader>
          <PasswordChangeForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
