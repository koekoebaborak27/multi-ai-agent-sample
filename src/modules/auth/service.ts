import { authRepository } from "@/modules/auth/repository";
import type { AuthenticatedUser } from "@/modules/auth/types";
import { env } from "@/shared/config/env";
import { AppError, Errors } from "@/shared/errors/app-error";
import { MESSAGES } from "@/shared/constants/messages";
import { isRole, type Role } from "@/shared/constants/roles";
import { hashPassword, verifyPassword } from "@/shared/security/password";
import type { User } from "@prisma/client";

/**
 * データベースの利用者情報を、ログイン状態として持ち回る形に詰め替える。
 * 役割の値が想定外だった場合は、いちばん権限の弱い閲覧のみの役割として扱う。
 */
function toAuthUser(u: User, authMethod: "entra" | "credentials"): AuthenticatedUser {
  return {
    id: u.id,
    role: (isRole(u.role) ? u.role : "VIEWER") as Role,
    mustChangePassword: u.mustChangePassword,
    authMethod,
    name: u.displayName,
    email: u.email,
  };
}

export const authService = {
  /** パスワードを、そのままでは元に戻せない形に変換する（保存前に必ず通す） */
  hashPassword(plain: string): Promise<string> {
    return hashPassword(plain);
  },

  /**
   * 入力された ID とパスワードが正しいかを確かめ、正しければ利用者の情報を返す。
   * 利用者の存在確認 → 利用停止の確認 → パスワードの照合、の順に調べ、
   * 失敗した場合は失敗回数を数え、既定の回数に達したらアカウントを利用停止にする。
   */
  async verifyCredentials(userId: string, password: string): Promise<AuthenticatedUser> {
    const user = await authRepository.findById(userId);
    // 利用者が存在しない場合も、退職などで削除済みの場合も、同じメッセージで返す。
    // どちらなのかを伝えると、存在する ID を探り当てる手がかりを与えてしまうため。
    if (!user || user.deleted) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }
    if (user.lockedAt) {
      throw new AppError("ACCOUNT_LOCKED", 403, MESSAGES.auth.locked, { userId });
    }
    // Microsoft アカウント専用の利用者はパスワードを持たないため、この方法ではログインできない
    if (!user.passwordHash) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }

    const okPassword = await verifyPassword(user.passwordHash, password).catch(() => false);
    if (!okPassword) {
      // パスワードの総当たりを防ぐため、失敗のたびに回数を数え、上限に達したら利用停止にする
      const attempts = await authRepository.incrementFailedAttempts(userId);
      if (attempts >= env.MAX_ATTEMPTS) {
        await authRepository.lock(userId);
        throw new AppError("ACCOUNT_LOCKED", 403, MESSAGES.auth.locked, { userId });
      }
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }

    // ログインできたら、それまでの失敗回数を消す（連続失敗でのみ利用停止になるようにするため）
    await authRepository.resetFailedAttempts(userId);
    return toAuthUser(user, "credentials");
  },

  /**
   * Microsoft アカウントでログインした利用者を、このアプリの利用者情報と結び付ける。
   * 初めてのログインなら利用者情報を新しく作る（そのときの役割は閲覧のみ）。
   * すでに削除済み・利用停止中の場合はログインさせない。
   */
  async provisionEntraUser(input: {
    externalId: string;
    email?: string | null;
    name?: string | null;
  }): Promise<AuthenticatedUser> {
    const user = await authRepository.upsertEntraUser(input);
    if (user.deleted || user.lockedAt) {
      throw new AppError("ACCOUNT_DISABLED", 403, MESSAGES.auth.locked, {
        externalId: input.externalId,
      });
    }
    return toAuthUser(user, "entra");
  },

  /**
   * パスワードを変更する。初回ログイン時の変更でも同じ処理を使う。
   * 本人以外が勝手に変更できないよう、現在のパスワードの入力を必須にしている。
   */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) throw Errors.notFound();
    // Microsoft アカウント専用の利用者はこのアプリでパスワードを管理していない
    if (!user.passwordHash) {
      throw Errors.forbidden("このアカウントはパスワード変更の対象外です");
    }
    const okCurrent = await verifyPassword(user.passwordHash, currentPassword).catch(() => false);
    if (!okCurrent) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }
    const newHash = await hashPassword(newPassword);
    await authRepository.updatePassword(userId, newHash);
  },
};
