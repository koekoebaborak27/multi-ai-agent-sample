import type { Role } from "@/shared/constants/roles";

/** 認証済みユーザー（JWT クレーム/セッションへ載せる最小情報） */
export interface AuthenticatedUser {
  id: string; // ユーザーID（ログインID）
  role: Role;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials";
  name?: string | null;
  email?: string | null;
}
