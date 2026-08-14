"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/shared/layout/nav-config";
import { ROLES, type Role } from "@/shared/constants/roles";
import { cn } from "@/shared/ui/utils";

/**
 * メニューの中身。画面幅の広いときの左メニューと、狭いときの折りたたみメニューで共通に使う。
 * onNavigate は、折りたたみメニューで項目を選んだときにメニューを閉じるために使う。
 */
export function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const pathname = usePathname();
  // 管理者向けの項目は、管理者以外には表示しない
  const items = NAV_ITEMS.filter((i) => !i.adminOnly || role === ROLES.ADMIN);

  return (
    <>
      <div className="flex h-14 shrink-0 items-center px-4 font-semibold">
        サンプル契約管理システム
      </div>
      <nav className="relative z-10 flex flex-col gap-1 p-2">
        {items.map((item) => {
          // 今いる画面の項目を目立たせる。
          // トップ画面だけは、すべてのURLの先頭に「/」が含まれてしまうため、完全一致で判定する。
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

// 画面左に固定表示するメニュー。画面幅が狭いときは表示せず、折りたたみメニューに切り替わる。
export function Sidebar({ role }: { role: Role }) {
  return (
    <aside className="relative hidden w-56 shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <SidebarNav role={role} />

      {/* メニュー下部の波型の飾り。操作の対象ではないため、読み上げの対象からも外している */}
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
