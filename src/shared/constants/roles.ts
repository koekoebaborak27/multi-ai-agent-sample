/** RBAC ロール定義（§4。設計書 §9.3） */
export const ROLES = {
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as string[]).includes(v);
}

/** 書き込み操作が可能なロール（VIEWER は閲覧のみ） */
export const WRITE_ROLES: Role[] = [ROLES.ADMIN, ROLES.OPERATOR];

export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}
