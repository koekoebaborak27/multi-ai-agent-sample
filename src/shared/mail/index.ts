import "server-only";
import { buildTemplate, type MailTemplate } from "@/shared/mail/templates";
import { deliverMail } from "@/shared/mail/transport";

/**
 * メールを送る唯一の窓口。
 * 呼ぶ側は「誰に・どの種類のメールを送るか」だけを指定し、文面は持たない。
 */
export async function sendMail(input: { to: string; template: MailTemplate }): Promise<void> {
  const { subject, body } = buildTemplate(input.template);
  await deliverMail({ to: input.to, subject, body });
}

export type { MailTemplate } from "@/shared/mail/templates";
