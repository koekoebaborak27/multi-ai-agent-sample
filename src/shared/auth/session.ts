import "server-only";
import { auth } from "@/modules/auth/auth";
import type { Role } from "@/shared/constants/roles";

/** 画面や保存処理から参照する、ログイン中の利用者の情報 */
export interface CurrentUser {
  id: string;
  role: Role;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials";
  displayName?: string | null;
  email?: string | null;
}

/**
 * 現在ログインしている利用者を取得する。ログインしていなければ「無し」を返す。
 * ログイン状態を保つ引換券から読み取るため、データベースへは問い合わせない。
 * サーバー側で動く処理からのみ使える。
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = session.user;
  return {
    id: u.id,
    role: u.role,
    mustChangePassword: u.mustChangePassword,
    authMethod: u.authMethod,
    displayName: u.name,
    email: u.email,
  };
}

/**
 * ログインが必要な場面で使う取得処理。
 * 現時点では取得するだけで、ログインしていなかったときにどうするか
 * （ログイン画面へ送るなど）は呼び出し側が決める。
 */
export async function requireUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
