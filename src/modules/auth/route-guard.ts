import { ROLES, type Role } from "@/shared/constants/roles";

/** 初回パスワード変更を行う画面のパス */
export const PASSWORD_CHANGE_PATH = "/settings/password";

export interface RouteGuardInput {
  /** リクエストのパス（クエリを含まない） */
  path: string;
  /** ログイン済みか */
  isLoggedIn: boolean;
  /** Server Action の呼び出しか（POST + next-action ヘッダ） */
  isServerAction: boolean;
  /** 初回パスワード変更が未了か */
  mustChangePassword: boolean;
  /** ロール（未ログイン時は null） */
  role: Role | null;
}

/**
 * proxy（middleware）のリダイレクト先を決める。リダイレクト不要なら null。
 *
 * middleware 本体から純粋関数として切り出しているのは、NextRequest を組み立てずに
 * 分岐を網羅テストするため（route-guard.test.ts）。
 */
export function decideRedirect(input: RouteGuardInput): string | null {
  const { path, isLoggedIn, isServerAction, mustChangePassword, role } = input;

  // 未ログイン: /login 以外は /login へ。
  // ここは Server Action でも緩めない（未認証のまま業務処理へ届かせないため）。
  if (!isLoggedIn) {
    return path.startsWith("/login") ? null : "/login";
  }

  // ── ログイン済みユーザーを目的の画面へ誘導するリダイレクト ──
  // Server Action の POST では行わない。middleware がここでリダイレクトすると
  // アクションの POST がそのまま転送先へ再送され、ログイン直後に
  // 「/ → /settings/password → / → …」と往復し続ける（2026-08-04 に本番で発生）。
  // 画面遷移（GET）でのみ誘導すれば足りる。
  if (!isServerAction) {
    if (path.startsWith("/login")) return "/";
    if (mustChangePassword && path !== PASSWORD_CHANGE_PATH) return PASSWORD_CHANGE_PATH;
  }

  // /admin/* は ADMIN 限定。こちらは認可なので Server Action でも適用する。
  if (path.startsWith("/admin") && role !== ROLES.ADMIN) return "/";

  return null;
}
