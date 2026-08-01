import "server-only";
import { auth } from "@/modules/auth/auth";
import type { Role } from "@/shared/constants/roles";

export interface CurrentUser {
  id: string;
  role: Role;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials";
  displayName?: string | null;
  email?: string | null;
}

/** 現在ログイン中のユーザーを取得（未ログインは null）。RSC/Server Action 専用。 */
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

/** ログイン必須。未ログインなら呼び出し側でリダイレクト等を行う。 */
export async function requireUser(): Promise<CurrentUser | null> {
  return getCurrentUser();
}
