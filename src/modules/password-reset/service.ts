import { authService } from "@/modules/auth";
import { passwordResetRepository } from "@/modules/password-reset/repository";
import { createToken, hashToken } from "@/modules/password-reset/token";
import type { SkipReason } from "@/modules/password-reset/types";
import type { ForgotPasswordInput } from "@/modules/password-reset/validation";
import { AppError } from "@/shared/errors/app-error";
import { sendMail } from "@/shared/mail";
import { childLogger } from "@/shared/observability/logger";

// 再設定用URLの有効期限（発行から30分）
const TOKEN_TTL_MS = 30 * 60 * 1000;
// 24時間あたりに送ってよい回数の上限
const MAX_REQUESTS_PER_DAY = 5;
// URLが使えないときに画面へ出す文言。理由（合言葉不一致・使用済み・期限切れ・利用者不在）
// によらず同じ文言にする。どれが原因かを外部から探れないようにするため。
const RESET_TOKEN_INVALID_MESSAGE =
  "このURLは使用済みか、有効期限が切れています。お手数ですが、もう一度お申し込みください。";

function resetTokenInvalid(): AppError {
  return new AppError("RESET_TOKEN_INVALID", 400, RESET_TOKEN_INVALID_MESSAGE);
}

// メールアドレス変更の確認用URLが使えないときに画面へ出す文言。
// 理由（合言葉不一致・使用済み・期限切れ・申し込んだ利用者と違う）によらず同じ文言にする。
const EMAIL_CHANGE_TOKEN_INVALID_MESSAGE =
  "このURLは使用済みか、有効期限が切れています。お手数ですが、もう一度お申し込みください。";

function emailChangeTokenInvalid(): AppError {
  return new AppError("EMAIL_CHANGE_TOKEN_INVALID", 400, EMAIL_CHANGE_TOKEN_INVALID_MESSAGE);
}

// メールアドレスが重複しているときに画面へ出す文言。申し込み時・確定時のどちらでも同じ文言にする。
const EMAIL_ALREADY_USED_MESSAGE = "このメールアドレスは既に使われています";

function emailAlreadyUsed(): AppError {
  return new AppError("EMAIL_ALREADY_USED", 409, EMAIL_ALREADY_USED_MESSAGE);
}

function emailSameAsCurrent(): AppError {
  return new AppError("EMAIL_SAME_AS_CURRENT", 422, "現在のメールアドレスと同じです");
}

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

  /** 再設定画面（PWR-02）を開けるかどうかを確かめる。開けない理由は問わない */
  async canOpen(token: string): Promise<boolean> {
    const found = await passwordResetRepository.findValidToken(hashToken(token), new Date());
    return found !== null;
  },

  /**
   * 新しいパスワードを確定する。
   * 確認は画面表示時と同じ内容をやり直し、通ったときだけパスワードを変更する。
   * 通知メールの送信に失敗しても、パスワードの変更自体は取り消さない。
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const now = new Date();
    const found = await passwordResetRepository.findValidToken(hashToken(token), now);
    if (!found) throw resetTokenInvalid();

    const passwordHash = await authService.hashPassword(newPassword);
    const ok = await passwordResetRepository.resetPassword({
      tokenId: found.token.id,
      userId: found.user.id,
      passwordHash,
      now,
    });
    if (!ok) throw resetTokenInvalid();

    if (found.user.email) {
      await sendMail({
        to: found.user.email,
        template: {
          kind: "password-changed",
          userId: found.user.id,
          displayName: found.user.displayName,
        },
      });
    }
  },

  /** ログイン中の利用者の、現在のメールアドレスを取得する（設定画面での表示・入力チェックに使う） */
  async getCurrentEmail(userId: string): Promise<string | null> {
    const user = await passwordResetRepository.findUserById(userId);
    return user?.email ?? null;
  },

  /**
   * メールアドレス変更の申し込みを受け付ける（EML-01）。
   * 入力チェック（validation.ts）でも「今のアドレスと同じでないこと」を確かめているが、
   * 呼び出し元によらず必ず守られるよう、ここでも同じ確認をやり直す。
   * この時点では User.email を変えない。確定は確認用URLを開いたとき（EML-02）に行う。
   */
  async requestEmailChange(userId: string, newEmailInput: string): Promise<void> {
    const newEmail = newEmailInput.toLowerCase();
    const user = await passwordResetRepository.findUserById(userId);

    if (user?.email === newEmail) throw emailSameAsCurrent();

    const existing = await passwordResetRepository.findUserByEmail(newEmail);
    if (existing) throw emailAlreadyUsed();

    const now = new Date();
    // 続けて申し込まれたとき「最後に届いたメールのURLだけが有効」になるよう、
    // 新しい合言葉を作る前に、これまで発行した分をすべて無効にする
    await passwordResetRepository.invalidateActiveEmailChangeTokens(userId, now);

    const token = createToken();
    await passwordResetRepository.createEmailChangeToken({
      userId,
      newEmail,
      tokenHash: hashToken(token),
      expiresAt: new Date(now.getTime() + TOKEN_TTL_MS),
    });

    await sendMail({
      to: newEmail,
      template: {
        kind: "email-change-confirm",
        token,
        userId,
        displayName: user?.displayName ?? null,
      },
    });
  },

  /**
   * 確認用URL（EML-02）を開いたときに、メールアドレスの変更を確定する。
   * 申し込み記録の利用者と、いまログインしている利用者が違う場合は、開けない扱いにする
   * （メールを盗み見た第三者が勝手に確定させることを防ぐため）。
   * 確定できたら、変更前のアドレス宛にお知らせメールを送る（変更前が未登録だった場合は送らない）。
   * 通知メールの送信に失敗しても、変更自体は取り消さない。
   */
  async confirmEmailChange(token: string, currentUserId: string): Promise<string> {
    const now = new Date();
    const found = await passwordResetRepository.findValidEmailChangeToken(hashToken(token), now);
    if (!found) throw emailChangeTokenInvalid();
    if (found.user.id !== currentUserId) throw emailChangeTokenInvalid();

    const result = await passwordResetRepository.confirmEmailChange({
      tokenId: found.token.id,
      userId: found.user.id,
      newEmail: found.token.newEmail,
      now,
    });
    if (result === "token_not_usable") throw emailChangeTokenInvalid();
    if (result === "email_already_used") throw emailAlreadyUsed();

    if (found.user.email) {
      await sendMail({
        to: found.user.email,
        template: {
          kind: "email-changed",
          userId: found.user.id,
          displayName: found.user.displayName,
        },
      });
    }

    return found.token.newEmail;
  },
};
