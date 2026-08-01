import { Building2, Database, FileText, Home, Users, type LucideIcon } from "lucide-react";

/** サイドバーのナビゲーション定義 */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: Home },
  { label: "マスタ", href: "/master", icon: Database },
  { label: "契約先", href: "/parties", icon: Building2 },
  { label: "契約", href: "/contracts", icon: FileText },
  { label: "ユーザー管理", href: "/admin/users", icon: Users, adminOnly: true },
];
