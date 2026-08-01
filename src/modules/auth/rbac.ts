import { ROLES, canWrite, type Role } from "@/shared/constants/roles";

/** ロール判定ユーティリティ（middleware/proxy・Server Action 双方で利用） */
export const rbac = {
  isAdmin: (role: Role): boolean => role === ROLES.ADMIN,
  canWrite,
  /** 必要ロールのいずれかを満たすか */
  hasAny: (role: Role, allowed: Role[]): boolean => allowed.includes(role),
};
