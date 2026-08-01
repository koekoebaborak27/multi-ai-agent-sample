import { z } from "zod";

/** 月（YYYYMM） */
export const yyyymm = z
  .string()
  .regex(/^\d{6}$/, "YYYYMM 形式で入力してください")
  .refine((v) => {
    const m = Number(v.slice(4, 6));
    return m >= 1 && m <= 12;
  }, "月は01〜12で指定してください");

/** 各種コード（英数記号の短い識別子） */
export const code = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[0-9A-Za-z_-]+$/, "コードは英数字・ハイフン・アンダースコアのみ使用できます");

/** ユーザーID（現行 Oracle 仕様: 7文字） */
export const userId = z.string().min(1).max(7);

/** CSV エンコーディング */
export const encoding = z.enum(["utf8", "shift_jis", "euc-jp"]).default("utf8");

/** 文字列の前後空白を除去して空文字を undefined に */
export const trimmedOptional = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();
