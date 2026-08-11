import pino, { type Logger } from "pino";
import { env } from "@/shared/config/env";

/**
 * 記録（ログ）の出力方法をまとめて決めている場所。
 *  - 本番: 機械が読み取りやすい形で出力し、Google Cloud 側で集めて検索できるようにする
 *  - ローカル: 環境変数 LOG_PRETTY を有効にすると、人が読みやすい形に整えて出力する
 *  - 隠すべき項目は下の一覧に基づいて自動的に伏せ字にする
 *
 * ※ 画面側と定期実行の処理の両方から使うため、サーバー専用の印は付けない。
 */

// 記録に残してはいけない項目の名前。
// ここに書いておけば、各処理でうっかり渡してしまっても自動的に伏せ字になる。
const REDACT_PATHS = [
  "password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "authorization",
  "headers.authorization",
  "headers.cookie",
  'headers["set-cookie"]',
  "AUTH_SECRET",
  "*.secret",
  "secret",
];

export const logger: Logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "***" },
  serializers: { err: pino.stdSerializers.err },
  // 実行中のプログラム番号やサーバー名は、ログを集める側が自動で付けるため、ここでは付けない
  base: undefined,
  ...(env.LOG_PRETTY
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }
    : {}),
});

/**
 * 決まった項目を毎回付けて出力する、専用の記録係を作る。
 * 処理の名前や番号を渡しておけば、そこから出力する記録すべてに同じ項目が付く。
 */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
