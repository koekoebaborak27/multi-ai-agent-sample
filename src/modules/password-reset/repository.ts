import { Prisma } from "@prisma/client";
import { prisma } from "@/shared/db/prisma";
import type { EmailChangeToken, PasswordResetToken, User } from "@prisma/client";

// 送信回数の上限を数える対象期間（24時間）
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

// 発行記録が確定の時点で使えない状態（使用済み・期限切れ）に変わっていたことを表す、
// このファイル内だけで使う印。$transaction の中で投げると、それまでの変更がすべて取り消される。
class TokenNotUsable extends Error {}

// 確定しようとした時点で、変更先のアドレスが他の利用者に使われていたことを表す、
// このファイル内だけで使う印。申し込みから確定までの間に登録された場合に備える。
class EmailAlreadyUsed extends Error {}

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

  // 合言葉の要約値から、有効な発行記録と対象の利用者をまとめて取得する。
  // 使用済み・期限切れ・利用者が存在しない（削除済み含む）のいずれかであれば null を返す
  // （どれが原因かは呼び出し側でも区別しない。画面には同じ「開けない」表示しかしないため）。
  async findValidToken(
    tokenHash: string,
    now: Date,
  ): Promise<{ token: PasswordResetToken; user: User } | null> {
    const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!token || token.usedAt || token.expiresAt <= now) return null;

    const user = await prisma.user.findUnique({ where: { id: token.userId } });
    if (!user || user.deleted) return null;

    return { token, user };
  },

  // 新しいパスワードを確定する。パスワードの更新・失敗回数とロックの解除・
  // 使った発行記録と他の未使用の発行記録の無効化を1つのまとまりとして行い、
  // 途中で失敗したらすべて元に戻す。
  // 確定しようとした時点で発行記録が使用済み・期限切れに変わっていた場合
  // （画面を開いたまま放置された、二重に送信された等）は、何も変更せず false を返す。
  async resetPassword(params: {
    tokenId: string;
    userId: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    try {
      await prisma.$transaction(async (tx) => {
        const usedToken = await tx.passwordResetToken.updateMany({
          where: { id: params.tokenId, usedAt: null, expiresAt: { gt: params.now } },
          data: { usedAt: params.now },
        });
        if (usedToken.count === 0) throw new TokenNotUsable();

        await tx.user.update({
          where: { id: params.userId },
          data: {
            passwordHash: params.passwordHash,
            mustChangePassword: false,
            failedAttempts: 0,
            lockedAt: null,
          },
        });

        await tx.passwordResetToken.updateMany({
          where: { userId: params.userId, usedAt: null, id: { not: params.tokenId } },
          data: { usedAt: params.now },
        });
      });
      return true;
    } catch (e) {
      if (e instanceof TokenNotUsable) return false;
      throw e;
    }
  },

  // 利用者IDから利用者を1件取得する（現在のメールアドレスの表示・確認に使う）
  findUserById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  // 指定した利用者の、未使用のメールアドレス変更申し込みをすべて無効にする
  async invalidateActiveEmailChangeTokens(userId: string, now: Date): Promise<void> {
    await prisma.emailChangeToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: now },
    });
  },

  // メールアドレス変更の申し込み記録を1件作る（合言葉そのものではなく要約値を保存する）
  createEmailChangeToken(data: {
    userId: string;
    newEmail: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<EmailChangeToken> {
    return prisma.emailChangeToken.create({ data });
  },

  // 合言葉の要約値から、有効なメールアドレス変更の申し込み記録と対象の利用者をまとめて取得する。
  // 使用済み・期限切れ・利用者が存在しない（削除済み含む）のいずれかであれば null を返す
  // （どれが原因かは呼び出し側でも区別しない。画面には同じ「開けない」表示しかしないため）。
  async findValidEmailChangeToken(
    tokenHash: string,
    now: Date,
  ): Promise<{ token: EmailChangeToken; user: User } | null> {
    const token = await prisma.emailChangeToken.findUnique({ where: { tokenHash } });
    if (!token || token.usedAt || token.expiresAt <= now) return null;

    const user = await prisma.user.findUnique({ where: { id: token.userId } });
    if (!user || user.deleted) return null;

    return { token, user };
  },

  // メールアドレスの変更を確定する。User.email の書き換え・使った申し込み記録と
  // 同じ利用者の他の未使用の申し込み記録の無効化を1つのまとまりとして行い、
  // 途中で失敗したらすべて元に戻す。
  //
  // 確定しようとした時点で申し込み記録が使用済み・期限切れに変わっていた場合は "token_not_usable"、
  // 変更先のアドレスが（申し込みから確定までの間に）他の利用者に使われていた場合は
  // "email_already_used" を返し、何も変更しない。
  async confirmEmailChange(params: {
    tokenId: string;
    userId: string;
    newEmail: string;
    now: Date;
  }): Promise<"ok" | "token_not_usable" | "email_already_used"> {
    try {
      await prisma.$transaction(async (tx) => {
        const usedToken = await tx.emailChangeToken.updateMany({
          where: { id: params.tokenId, usedAt: null, expiresAt: { gt: params.now } },
          data: { usedAt: params.now },
        });
        if (usedToken.count === 0) throw new TokenNotUsable();

        const duplicated = await tx.user.findUnique({ where: { email: params.newEmail } });
        if (duplicated && duplicated.id !== params.userId) throw new EmailAlreadyUsed();

        await tx.user.update({
          where: { id: params.userId },
          data: { email: params.newEmail },
        });

        await tx.emailChangeToken.updateMany({
          where: { userId: params.userId, usedAt: null, id: { not: params.tokenId } },
          data: { usedAt: params.now },
        });
      });
      return "ok";
    } catch (e) {
      if (e instanceof TokenNotUsable) return "token_not_usable";
      if (e instanceof EmailAlreadyUsed) return "email_already_used";
      // 事前確認をすり抜けて一意制約（User.email）に引っかかった場合も、同じ扱いにする
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return "email_already_used";
      }
      throw e;
    }
  },
};
