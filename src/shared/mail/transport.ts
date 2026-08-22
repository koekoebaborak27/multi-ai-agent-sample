import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import { childLogger } from "@/shared/observability/logger";

/** 送信を依頼する内容。件名・本文はあらかじめ組み立て済みのものを渡す */
export interface MailMessage {
  to: string;
  subject: string;
  body: string;
}

const log = childLogger({ op: "mail:send" });

/** SMTP接続に必要な設定が揃っているか確かめる。env.ts が起動時に検証済みのため通常は起きない */
function requireSmtpConfig() {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASSWORD) {
    throw new Error("SMTP_HOST / SMTP_USER / SMTP_PASSWORD が未設定です");
  }
  return { host: env.SMTP_HOST, user: env.SMTP_USER, password: env.SMTP_PASSWORD };
}

// SMTP接続先は使い回す（送信のたびに毎回新規接続すると無駄に時間がかかる）
let smtpTransport: Transporter | undefined;

function getSmtpTransport(): Transporter {
  if (!smtpTransport) {
    const { host, user, password } = requireSmtpConfig();
    smtpTransport = nodemailer.createTransport({
      host,
      port: env.SMTP_PORT,
      secure: false, // 587番はSTARTTLS（接続後に暗号化へ切り替える）を使うためfalse
      auth: { user, pass: password },
    });
  }
  return smtpTransport;
}

/**
 * メールを実際に届ける。
 *
 * MAIL_TRANSPORT=console のときは送らず、宛先・件名・本文をログへ出すだけにする。
 * MAIL_TRANSPORT=smtp のときは実際に送る。このときは送信の成否だけをログへ残し、
 * 本文とURL（合言葉を含む）はログに出さない。
 */
export async function deliverMail(message: MailMessage): Promise<void> {
  if (env.MAIL_TRANSPORT === "console") {
    log.info(
      { to: message.to, subject: message.subject, body: message.body },
      "メール送信（console。実際には送信していません）",
    );
    return;
  }

  const { user } = requireSmtpConfig();
  const fromAddress = env.MAIL_FROM || user;
  const from = env.MAIL_FROM_NAME ? `"${env.MAIL_FROM_NAME}" <${fromAddress}>` : fromAddress;

  try {
    await getSmtpTransport().sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.body,
    });
    log.info({ to: message.to, subject: message.subject }, "メール送信に成功");
  } catch (err) {
    log.error({ err, to: message.to, subject: message.subject }, "メール送信に失敗");
    throw new AppError("MAIL_SEND_FAILED", 502, "メールの送信に失敗しました", { to: message.to });
  }
}
