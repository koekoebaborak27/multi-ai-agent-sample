import { passwordResetRepository } from "@/modules/password-reset/repository";
import { createToken, hashToken } from "@/modules/password-reset/token";
import type { SkipReason } from "@/modules/password-reset/types";
import type { ForgotPasswordInput } from "@/modules/password-reset/validation";
import { sendMail } from "@/shared/mail";
import { childLogger } from "@/shared/observability/logger";

// 再設定用URLの有効期限（発行から30分）
const TOKEN_TTL_MS = 30 * 60 * 1000;
// 24時間あたりに送ってよい回数の上限
const MAX_REQUESTS_PER_DAY = 5;

const log = childLogger({ op: "password-reset.request" });

// 受付を見送ったことを記録する。
// 登録の有無を外部から探れないよう画面には一切出さないため、追跡できる手がかりはここにしか残らない。
function logSkipped(email: string, reason: SkipReason): void {
  log.info({ email, reason }, "パスワード再発行の申請を受け付けなかった");
}

export const passwordResetService = {
  /**
   * パスワード再発行の申請を受け付ける。
   * 利用者が見つからない・削除済み・送信回数の上限超過のいずれでも、呼び出し側からは
   * 区別が付かないように何も返さない（同じ受付完了の画面を出すため）。
   */
  async requestReset(input: ForgotPasswordInput): Promise<void> {
    const email = input.email.toLowerCase();
    const user = await passwordResetRepository.findUserByEmail(email);
    if (!user) {
      logSkipped(email, "user_not_found");
      return;
    }
    if (user.deleted) {
      logSkipped(email, "user_deleted");
      return;
    }

    const now = new Date();
    const recentCount = await passwordResetRepository.countRecentTokens(user.id, now);
    if (recentCount >= MAX_REQUESTS_PER_DAY) {
      logSkipped(email, "rate_limited");
      return;
    }

    // 続けて申し込まれたとき「最後に届いたメールのURLだけが有効」になるよう、
    // 新しい合言葉を作る前に、これまで発行した分をすべて無効にする
    await passwordResetRepository.invalidateActiveTokens(user.id, now);

    const token = createToken();
    await passwordResetRepository.create({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    });

    await sendMail({
      to: email,
      template: { kind: "password-reset", token, userId: user.id, displayName: user.displayName },
    });
  },
};
