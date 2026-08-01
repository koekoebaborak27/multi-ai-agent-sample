"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { VisuallyHidden } from "radix-ui";
import { SidebarNav } from "@/shared/layout/sidebar";
import { Button } from "@/shared/ui/button";
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from "@/shared/ui/drawer";
import type { Role } from "@/shared/constants/roles";

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
        <VisuallyHidden.Root>
          <DrawerTitle>メニュー</DrawerTitle>
        </VisuallyHidden.Root>
        <SidebarNav role={role} onNavigate={() => setOpen(false)} />
      </DrawerContent>
    </Drawer>
  );
}
