import pino, { type Logger } from "pino";
import { env } from "@/shared/config/env";

/**
 * 構造化ログの中央設定。
 *  - 本番: stdout に JSON（Cloud Logging に集約）
 *  - ローカル: LOG_PRETTY=true で pino-pretty 整形
 *  - 機密情報は redact で中央集約マスキング（開発者が意識不要）
 * ※ app / worker 双方から共有する。`server-only` は付けない。
 */
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
  base: undefined, // pid/hostname は CloudWatch 側で付与されるため抑制
  ...(env.LOG_PRETTY
    ? {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:HH:MM:ss.l", ignore: "pid,hostname" },
        },
      }
    : {}),
});

/** 任意のバインドフィールドを持つ子ロガーを生成する */
export function childLogger(bindings: Record<string, unknown>): Logger {
  return logger.child(bindings);
}
