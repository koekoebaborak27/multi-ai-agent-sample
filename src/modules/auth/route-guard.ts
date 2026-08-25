import { ROLES, type Role } from "@/shared/constants/roles";

/** 初回パスワード変更を行う画面のパス */
export const PASSWORD_CHANGE_PATH = "/settings/password";

/** ログインしていなくても開ける画面のパス（前方一致で判定する） */
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/about"];

/** 移動先を決めるために必要な、リクエスト1件分の情報 */
export interface RouteGuardInput {
  /** リクエストのパス（クエリを含まない） */
  path: string;
  /** ログイン済みか */
  isLoggedIn: boolean;
  /** 画面の表示ではなく、保存などの処理の呼び出しかどうか */
  isServerAction: boolean;
  /** 初回パスワード変更が未了か */
  mustChangePassword: boolean;
  /** ロール（未ログイン時は null） */
  role: Role | null;
}

/**
 * リクエストの内容から、別の画面へ移動させるべきかを判断し、移動先を返す。移動が不要なら null を返す。
 *
 * 実際にリクエストを受け取る処理（src/proxy.ts）から、この判断部分だけを切り出している。
 * リクエストそのものを組み立てなくても、条件を並べるだけで全ての分岐を試験できるようにするため。
 */
export function decideRedirect(input: RouteGuardInput): string | null {
  const { path, isLoggedIn, isServerAction, mustChangePassword, role } = input;

  // 未ログインなら、ログイン不要な画面以外はすべてログイン画面へ送る。
  // 保存などの処理の呼び出しでも同じように止める（ログインしないまま業務処理に届かせないため）。
  if (!isLoggedIn) {
    return PUBLIC_PATHS.some((p) => path.startsWith(p)) ? null : "/login";
  }

  // ここからは、ログイン済みの利用者を本来居るべき画面へ案内する処理。
  // 保存などの処理の呼び出しでは行わない。もしここで移動させると、
  // 保存の要求がそのまま移動先へ送り直され、ログイン直後に
  // 「/ → /settings/password → / → …」と行き来し続けてしまう。
  // 画面を開いたときだけ案内すれば十分。
  if (!isServerAction) {
    if (path.startsWith("/login")) return "/";
    if (mustChangePassword && path !== PASSWORD_CHANGE_PATH) return PASSWORD_CHANGE_PATH;
  }

  // 管理者向けの画面は管理者だけが開ける。
  // こちらは権限の確認なので、画面の表示か保存処理かを問わず必ず適用する。
  if (path.startsWith("/admin") && role !== ROLES.ADMIN) return "/";

  // お知らせ管理は管理者と担当者だけが開ける。
  // 画面上のメニューを隠してもURLを直接入力できるため、入口でも閲覧者を止める。
  if (path.startsWith("/news") && role === ROLES.VIEWER) return "/";

  return null;
}
