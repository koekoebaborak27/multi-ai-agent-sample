"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { VisuallyHidden } from "radix-ui";
import { SidebarNav } from "@/shared/layout/sidebar";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import type { Role } from "@/shared/constants/roles";

// 画面幅が狭いときに使う、折りたたみ式のメニュー。
// ボタンを押すと横から出てきて、項目を選ぶと自動的に閉じる。
export function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);

  return (
    <Drawer open={open} onOpenChange={setOpen} direction="left">
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="メニューを開く" className="md:hidden">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="bg-sidebar text-sidebar-foreground">
        {/*
          見た目には表示しないが、読み上げ機能の利用者に「これはメニュー」と伝えるための見出し。
          この見出しが無いと、開いたものが何なのか分からないまま読み上げられてしまう。
        */}
        <VisuallyHidden.Root>
          <DrawerTitle>メニュー</DrawerTitle>
        </VisuallyHidden.Root>
        <SidebarNav role={role} onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
