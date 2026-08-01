import { randomInt } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import type { User } from "@prisma/client";

/** users への Prisma アクセス（auth モジュール専用） */
export const authRepository = {
  findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  findByExternalId(externalId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { externalId } });
  },

  async incrementFailedAttempts(userId: string): Promise<number> {
    const u = await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });
    return u.failedAttempts;
  },

  async resetFailedAttempts(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedAt: null },
    });
  },

  async lock(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedAt: new Date() },
    });
  },

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, failedAttempts: 0 },
    });
  },

  /** Entra 自動プロビジョン: externalId 未登録なら作成して返す */
  async upsertEntraUser(input: {
    externalId: string;
    email?: string | null;
    name?: string | null;
  }): Promise<User> {
    const existing = await prisma.user.findUnique({ where: { externalId: input.externalId } });
    if (existing) return existing;

    // Entra 由来ユーザは "entra-" + 8桁英数字 で採番（衝突時は数回リトライ）
    for (let i = 0; i < 5; i++) {
      const candidate =
        "entra-" +
        randomInt(0, 36 ** 8)
          .toString(36)
          .padStart(8, "0");
      const dup = await prisma.user.findUnique({ where: { id: candidate } });
      if (dup) continue;
      return prisma.user.create({
        data: {
          id: candidate,
          role: "VIEWER", // 最小権限。昇格は ADMIN が実施
          externalId: input.externalId,
          email: input.email ?? null,
          displayName: input.name ?? null,
        },
      });
    }
    throw new Error("ユーザーIDの採番に失敗しました（衝突多発）");
  },
};
