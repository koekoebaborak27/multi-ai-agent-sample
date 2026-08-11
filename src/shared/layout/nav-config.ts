import { Building2, Database, FileText, Home, Users, type LucideIcon } from "lucide-react";

/** メニュー1項目分の定義。adminOnly が付いた項目は管理者にだけ表示する */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

// メニューに並べる項目の一覧。ここに書いた順にそのまま表示される。
// 画面幅の広いときの左メニューと、狭いときの折りたたみメニューが、どちらもこの定義を使う。
export const NAV_ITEMS: NavItem[] = [
  { label: "ダッシュボード", href: "/", icon: Home },
  { label: "マスタ", href: "/master", icon: Database },
  { label: "契約先", href: "/parties", icon: Building2 },
  { label: "契約", href: "/contracts", icon: FileText },
  { label: "ユーザー管理", href: "/admin/users", icon: Users, adminOnly: true },
];
