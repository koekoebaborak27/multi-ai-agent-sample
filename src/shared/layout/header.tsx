import { MobileNav } from "@/shared/layout/mobile-nav";
import { UserMenu } from "@/shared/layout/user-menu";
import type { Role } from "@/shared/constants/roles";

export function Header({ displayName, role }: { displayName: string; role: Role }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <MobileNav role={role} />
      <div className="ml-auto flex items-center gap-4">
        <span className="text-sm">
          {displayName}
          <span className="ml-2 rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">
            {role}
          </span>
        </span>
        <UserMenu />
      </div>
    </header>
  );
}
