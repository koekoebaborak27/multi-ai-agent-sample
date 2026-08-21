/**
 * 対象: shared/mail/transport
 * 目的: MAIL_TRANSPORT の設定に応じて「送らずログへ出すだけ」と「実際にSMTPで送る」を
 *       正しく切り替えられることを担保する。
 *       実際に送るときは、本文とURL（合言葉を含む）をログへ出さないこと、
 *       送信元アドレス・差出人表示名の組み立て、失敗時にAppErrorへ変換することも確認する。
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// 実際に通信すると試験が外部の状態に左右されるため、送信の仕組みごと差し替える
const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: { createTransport: createTransportMock },
}));

// 実際に記録を出力すると内容を確認できないため、記録係を差し替えて中身を捕まえる
const { errorMock, infoMock, childLoggerMock } = vi.hoisted(() => {
  const errorMock = vi.fn();
  const infoMock = vi.fn();
  const childLoggerMock = vi.fn(() => ({ error: errorMock, info: infoMock }));
  return { errorMock, infoMock, childLoggerMock };
});

vi.mock("@/shared/observability/logger", () => ({
  childLogger: childLoggerMock,
}));

const baseEnv = {
  MAIL_TRANSPORT: "console" as "console" | "smtp",
  MAIL_FROM: "",
  MAIL_FROM_NAME: "契約管理システム",
  SMTP_HOST: "smtp.example.test",
  SMTP_PORT: 587,
  SMTP_USER: "sender@example.test",
  SMTP_PASSWORD: "app-password",
};
let mockEnv = { ...baseEnv };

vi.mock("@/shared/config/env", () => ({
  get env() {
    return mockEnv;
  },
}));

import { isAppError } from "@/shared/errors/app-error";
import { deliverMail } from "@/shared/mail/transport";

beforeEach(() => {
  mockEnv = { ...baseEnv };
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  errorMock.mockClear();
  infoMock.mockClear();
});

describe("shared/mail/transport", () => {
  describe("MAIL_TRANSPORT=console のとき", () => {
    it("SMTPへ接続せず、宛先・件名・本文をログへ出す", async () => {
      await deliverMail({ to: "a@example.test", subject: "件名", body: "本文" });

      expect(createTransportMock).not.toHaveBeenCalled();
      expect(sendMailMock).not.toHaveBeenCalled();
      expect(infoMock).toHaveBeenCalledWith(
        expect.objectContaining({ to: "a@example.test", subject: "件名", body: "本文" }),
        expect.any(String),
      );
    });
  });

  describe("MAIL_TRANSPORT=smtp のとき", () => {
    beforeEach(() => {
      mockEnv.MAIL_TRANSPORT = "smtp";
    });

    describe("送信に成功したとき", () => {
      beforeEach(() => {
        sendMailMock.mockResolvedValue(undefined);
      });

      it("差出人表示名付きの from で送る", async () => {
        await deliverMail({ to: "a@example.test", subject: "件名", body: "本文" });

        expect(sendMailMock).toHaveBeenCalledWith(
          expect.objectContaining({
            from: '"契約管理システム" <sender@example.test>',
            to: "a@example.test",
            subject: "件名",
            text: "本文",
          }),
        );
      });

      it("MAIL_FROM が未設定なら SMTP_USER を送信元アドレスに使う", async () => {
        await deliverMail({ to: "a@example.test", subject: "件名", body: "本文" });

        expect(sendMailMock).toHaveBeenCalledWith(
          expect.objectContaining({ from: expect.stringContaining("sender@example.test") }),
        );
      });

      it("MAIL_FROM が設定されていればそちらを送信元アドレスに使う", async () => {
        mockEnv.MAIL_FROM = "from@example.test";

        await deliverMail({ to: "a@example.test", subject: "件名", body: "本文" });

        expect(sendMailMock).toHaveBeenCalledWith(
          expect.objectContaining({ from: expect.stringContaining("from@example.test") }),
        );
      });

      it("成功のログに本文を含めない", async () => {
        await deliverMail({ to: "a@example.test", subject: "件名", body: "秘密の合言葉URL" });

        for (const call of infoMock.mock.calls) {
          expect(JSON.stringify(call)).not.toContain("秘密の合言葉URL");
        }
      });
    });

    describe("送信に失敗したとき", () => {
      it("AppError(MAIL_SEND_FAILED) を投げ、失敗をログへ残す", async () => {
        sendMailMock.mockRejectedValue(new Error("接続に失敗しました"));

        try {
          await deliverMail({ to: "a@example.test", subject: "件名", body: "本文" });
          throw new Error("AppError が投げられませんでした");
        } catch (e) {
          expect(isAppError(e) && e.code).toBe("MAIL_SEND_FAILED");
        }
        expect(errorMock).toHaveBeenCalledTimes(1);
      });

      it("失敗のログに本文を含めない", async () => {
        sendMailMock.mockRejectedValue(new Error("接続に失敗しました"));

        await expect(
          deliverMail({ to: "a@example.test", subject: "件名", body: "秘密の合言葉URL" }),
        ).rejects.toThrow();

        for (const call of errorMock.mock.calls) {
          expect(JSON.stringify(call)).not.toContain("秘密の合言葉URL");
        }
      });
    });
  });
});
