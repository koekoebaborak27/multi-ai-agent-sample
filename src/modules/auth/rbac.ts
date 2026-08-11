import { ROLES, canWrite, type Role } from "@/shared/constants/roles";

// 利用者の役割（管理者・一般など）から、その操作を行ってよいかを判定する関数をまとめたもの。
// 画面を開く前の確認と、保存処理の入口での確認の両方から使う。
export const rbac = {
  /** 管理者かどうか */
  isAdmin: (role: Role): boolean => role === ROLES.ADMIN,
  /** 登録・更新を行ってよい役割かどうか */
  canWrite,
  /** 指定した役割のいずれかに当てはまるかどうか */
  hasAny: (role: Role, allowed: Role[]): boolean => allowed.includes(role),
};
