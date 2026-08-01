import { describe, expect, it } from "vitest";
import { rbac } from "@/modules/auth/rbac";
import { ROLES } from "@/shared/constants/roles";

describe("rbac", () => {
  it("ADMIN のみ isAdmin が true", () => {
    expect(rbac.isAdmin(ROLES.ADMIN)).toBe(true);
    expect(rbac.isAdmin(ROLES.OPERATOR)).toBe(false);
    expect(rbac.isAdmin(ROLES.VIEWER)).toBe(false);
  });

  it("VIEWER は書込不可、ADMIN/OPERATOR は書込可", () => {
    expect(rbac.canWrite(ROLES.ADMIN)).toBe(true);
    expect(rbac.canWrite(ROLES.OPERATOR)).toBe(true);
    expect(rbac.canWrite(ROLES.VIEWER)).toBe(false);
  });

  it("hasAny は許可ロール集合で判定する", () => {
    expect(rbac.hasAny(ROLES.OPERATOR, [ROLES.ADMIN, ROLES.OPERATOR])).toBe(true);
    expect(rbac.hasAny(ROLES.VIEWER, [ROLES.ADMIN, ROLES.OPERATOR])).toBe(false);
  });
});
