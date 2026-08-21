import { prisma } from "@/shared/db/prisma";
import type { PasswordResetToken, User } from "@prisma/client";

// 送信回数の上限を数える対象期間（24時間）
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export const passwordResetRepository = {
  // メールアドレス（小文字）から利用者を1件取得する
  findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email } });
  },

  // 直近24時間に発行した再設定用URLの件数を数える（送信回数の上限判定に使う）
  countRecentTokens(userId: string, now: Date): Promise<number> {
    return prisma.passwordResetToken.count({
      where: { userId, createdAt: { gte: new Date(now.getTime() - RATE_LIMIT_WINDOW_MS) } },
    });
  },

  // 指定した利用者の、未使用・期限内の再設定用URLをすべて無効にする
  async invalidateActiveTokens(userId: string, now: Date): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
  },

  // 再設定用URLの発行記録を1件作る（合言葉そのものではなく要約値を保存する）
  create(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<PasswordResetToken> {
    return prisma.passwordResetToken.create({ data });
  },
};
