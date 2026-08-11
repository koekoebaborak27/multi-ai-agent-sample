import type { Role } from "@/shared/constants/roles";

/**
 * ログイン中の利用者の情報。
 * ログイン状態を保つための引換券に埋め込んで持ち回るため、
 * 画面の表示と権限の判定に必要な最小限の項目だけを持たせている。
 */
export interface AuthenticatedUser {
  id: string; // ユーザーID（ログインID）
  role: Role;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials";
  name?: string | null;
  email?: string | null;
}
