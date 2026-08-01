import { hash, verify } from "@node-rs/argon2";
import { authRepository } from "@/modules/auth/repository";
import type { AuthenticatedUser } from "@/modules/auth/types";
import { env } from "@/shared/config/env";
import { AppError, Errors } from "@/shared/errors/app-error";
import { MESSAGES } from "@/shared/constants/messages";
import { isRole, type Role } from "@/shared/constants/roles";
import type { User } from "@prisma/client";

const ARGON2_OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

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
  /** Argon2id ハッシュ生成 */
  hashPassword(plain: string): Promise<string> {
    return hash(plain, ARGON2_OPTS);
  },

  /**
   * ID/PW 認証:
   * 存在チェック → ロック判定 → ハッシュ照合 → 失敗回数/ロック更新 → 成功時リセット
   */
  async verifyCredentials(userId: string, password: string): Promise<AuthenticatedUser> {
    const user = await authRepository.findById(userId);
    // 存在しない/削除済みでも詳細は明かさない
    if (!user || user.deleted) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }
    if (user.lockedAt) {
      throw new AppError("ACCOUNT_LOCKED", 403, MESSAGES.auth.locked, { userId });
    }
    // Entra 専用ユーザ（PWなし）は Credentials ログイン不可
    if (!user.passwordHash) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }

    const okPassword = await verify(user.passwordHash, password).catch(() => false);
    if (!okPassword) {
      const attempts = await authRepository.incrementFailedAttempts(userId);
      if (attempts >= env.MAX_ATTEMPTS) {
        await authRepository.lock(userId);
        throw new AppError("ACCOUNT_LOCKED", 403, MESSAGES.auth.locked, { userId });
      }
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }

    await authRepository.resetFailedAttempts(userId);
    return toAuthUser(user, "credentials");
  },

  /** Entra ログイン時の突合/自動プロビジョン（初期ロール VIEWER） */
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

  /** パスワード変更（初回強制変更にも使用） */
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await authRepository.findById(userId);
    if (!user) throw Errors.notFound();
    if (!user.passwordHash) {
      throw Errors.forbidden("このアカウントはパスワード変更の対象外です");
    }
    const okCurrent = await verify(user.passwordHash, currentPassword).catch(() => false);
    if (!okCurrent) {
      throw Errors.unauthorized(MESSAGES.auth.invalidCredentials);
    }
    const newHash = await hash(newPassword, ARGON2_OPTS);
    await authRepository.updatePassword(userId, newHash);
  },
};
