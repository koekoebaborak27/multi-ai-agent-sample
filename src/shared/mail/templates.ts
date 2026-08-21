import { env } from "@/shared/config/env";

/** メール本文の宛先氏名。表示名が未設定の利用者にはログインIDをそのまま使う */
interface Recipient {
  userId: string;
  displayName: string | null;
}

/**
 * パスワード再発行機能で送る4種類のメール。
 * 種類ごとに必要な項目だけを持たせ、呼ぶ側が文面を組み立てずに済むようにする。
 */
export type MailTemplate =
  | ({ kind: "password-reset"; token: string } & Recipient)
  | ({ kind: "password-changed" } & Recipient)
  | ({ kind: "email-change-confirm"; token: string } & Recipient)
  | ({ kind: "email-changed" } & Recipient);

interface BuiltMail {
  subject: string;
  body: string;
}

function greetingName(recipient: Recipient): string {
  return recipient.displayName ?? recipient.userId;
}

/** 種類ごとに件名と本文（プレーンテキスト）を組み立てる */
export function buildTemplate(template: MailTemplate): BuiltMail {
  const name = greetingName(template);

  switch (template.kind) {
    case "password-reset":
      return {
        subject: "パスワード再設定のご案内",
        body: `${name} 様

パスワードの再設定を受け付けました。
下記のURLを開き、新しいパスワードを設定してください。

${env.APP_BASE_URL}/reset-password/${template.token}

このURLは30分で使えなくなります。また、一度使うと開けなくなります。
心当たりがない場合は、このメールを破棄してください。パスワードは変更されません。`,
      };

    case "password-changed":
      return {
        subject: "パスワードを変更しました",
        body: `${name} 様

パスワードが変更されました。

心当たりがない場合は、システムの管理者へご連絡ください。`,
      };

    case "email-change-confirm":
      return {
        subject: "メールアドレス変更の確認",
        body: `${name} 様

メールアドレスの変更を受け付けました。
下記のURLを開くと、変更が完了します。

${env.APP_BASE_URL}/settings/email/confirm/${template.token}

このURLは30分で使えなくなります。
心当たりがない場合は、このメールを破棄してください。変更は行われません。`,
      };

    case "email-changed":
      return {
        subject: "メールアドレスを変更しました",
        body: `${name} 様

登録されているメールアドレスが変更されました。

心当たりがない場合は、システムの管理者へご連絡ください。`,
      };
  }
}
