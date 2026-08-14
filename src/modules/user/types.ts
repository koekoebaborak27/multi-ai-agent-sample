import type { Role } from "@/shared/constants/roles";

// 利用者一覧で並び替えできる項目の一覧。
// 「ログイン方法」と「状態」は画面上の表示で、データベースの項目とは1対1で対応しない。
export const USER_SORT_FIELDS = ["userId", "displayName", "role", "authMethod", "status"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

/** 利用者一覧に表示する1行分の情報。パスワードは画面へ渡さない */
export interface UserSummary {
  userId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
  locked: boolean;
  mustChangePassword: boolean;
  authMethod: "entra" | "credentials" | "none";
}
