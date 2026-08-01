import type { Role } from "@/shared/constants/roles";

/** 一覧/表示用のユーザー要約（パスワード等は含めない） */
export interface UserSummary {
  userId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
  locked: boolean;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials" | "none";
}
