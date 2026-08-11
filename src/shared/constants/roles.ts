/**
 * 利用者の役割の定義。この3つが権限の判定すべての土台になる。
 *  - ADMIN:    管理者。利用者の管理を含め、すべての操作ができる
 *  - OPERATOR: 担当者。業務データの登録・更新ができる
 *  - VIEWER:   閲覧者。見ることだけができる
 */
export const ROLES = {
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  VIEWER: "VIEWER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** すべての役割の一覧。役割を選ぶプルダウンの選択肢などに使う */
export const ALL_ROLES: Role[] = [ROLES.ADMIN, ROLES.OPERATOR, ROLES.VIEWER];

/**
 * 渡された値が、定義済みの役割かどうかを判定する。
 * データベースに想定外の値が入っていた場合に気付けるようにするために使う。
 */
export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ALL_ROLES as string[]).includes(v);
}

/** 登録・更新ができる役割。閲覧者は見ることしかできない */
export const WRITE_ROLES: Role[] = [ROLES.ADMIN, ROLES.OPERATOR];

/** 登録・更新を行ってよい役割かどうかを判定する */
export function canWrite(role: Role): boolean {
  return WRITE_ROLES.includes(role);
}
