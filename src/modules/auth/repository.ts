import { randomInt } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import type { User } from "@prisma/client";

// ログイン処理から利用者テーブルを読み書きする部分をまとめたもの。
export const authRepository = {
  // ログインIDで利用者を1件取得する
  findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  // Microsoft アカウント側の識別子で利用者を1件取得する
  findByExternalId(externalId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { externalId } });
  },

  // ログイン失敗の回数を 1 増やし、増やした後の回数を返す。
  // 返した回数を見て、利用停止にするかどうかを呼び出し側が判断する。
  async incrementFailedAttempts(userId: string): Promise<number> {
    const u = await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: { increment: 1 } },
      select: { failedAttempts: true },
    });
    return u.failedAttempts;
  },

  // ログイン失敗の回数を 0 に戻し、利用停止も解除する（ログインに成功したときに使う）
  async resetFailedAttempts(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { failedAttempts: 0, lockedAt: null },
    });
  },

  // 利用者を利用停止にする。停止した日時を記録し、以降ログインできないようにする。
  async lock(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { lockedAt: new Date() },
    });
  },

  // パスワードを変更する。
  // あわせて「初回パスワード変更が必要」の印を外し、失敗回数も 0 に戻す。
  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false, failedAttempts: 0 },
    });
  },

  /**
   * Microsoft アカウントの利用者を取得し、まだ登録が無ければ新しく作って返す。
   * 管理者が事前に利用者を1件ずつ登録しなくても使い始められるようにするための処理。
   */
  async upsertEntraUser(input: {
    externalId: string;
    email?: string | null;
    name?: string | null;
  }): Promise<User> {
    const existing = await prisma.user.findUnique({ where: { externalId: input.externalId } });
    if (existing) return existing;

    // ログインIDは「entra-」＋ランダムな8文字で自動的に決める。
    // まれに既存のIDと重なることがあるため、重なった場合は作り直しを数回試す。
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
          role: "VIEWER", // 最初は閲覧のみ。権限を上げるのは管理者が行う
          externalId: input.externalId,
          email: input.email ?? null,
          displayName: input.name ?? null,
        },
      });
    }
    throw new Error("ユーザーIDの採番に失敗しました（衝突多発）");
  },
};
