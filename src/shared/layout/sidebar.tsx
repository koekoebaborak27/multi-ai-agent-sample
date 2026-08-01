"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/shared/layout/nav-config";
import { ROLES, type Role } from "@/shared/constants/roles";
import { cn } from "@/shared/ui/utils";

/** サイドバーとモバイルメニューの両方で使う共通ナビゲーション */
export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === ROLES.ADMIN);

  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-4 font-semibold">
        サンプル契約管理システム
      </div>
      <nav className="relative z-10 flex flex-col gap-1 p-2">
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="relative hidden w-56 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <SidebarNav role={role} />

      <svg
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 w-full text-sidebar-accent opacity-30"
        viewBox="0 0 224 160"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M-20 120 C 40 80, 80 160, 140 110 S 240 60, 260 100 L 260 180 L -20 180 Z"
          fill="currentColor"
        />
        <path
          d="M-20 150 C 60 110, 100 180, 160 140 S 250 100, 270 140 L 270 180 L -20 180 Z"
          fill="currentColor"
          opacity="0.6"
        />
      </svg>
    </aside>
  );
}
