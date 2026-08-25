import { Bell, Building2, Database, FileText, Home, Users, type LucideIcon } from "lucide-react";

/** メニュー1項目分の定義。権限に応じて表示を切り替えるための情報も持つ */
export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  hideForViewer?: boolean;
}

// メニューに並べる項目の一覧。ここに書いた順にそのまま表示される。
// 画面幅の広いときの左メニューと、狭いときの折りたたみメニューが、どちらもこの定義を使う。
export const NAV_ITEMS: NavItem[] = [
  { label: "トップ", href: "/", icon: Home },
  { label: "マスタ", href: "/master", icon: Database },
  { label: "契約先", href: "/parties", icon: Building2 },
  { label: "契約", href: "/contracts", icon: FileText },
  { label: "お知らせ管理", href: "/news", icon: Bell, hideForViewer: true },
  { label: "ユーザー管理", href: "/admin/users", icon: Users, adminOnly: true },
];
