import { z } from "zod";

// 複数の機能で使いまわす入力チェックの部品をまとめたもの。
// 同じ条件を各機能で書き直さずに済むようにしている。

/** 年月の入力チェック。「202608」のように6桁で受け取り、月が1〜12であることも確かめる */
export const yyyymm = z
  .string()
  .regex(/^\d{6}$/, "YYYYMM 形式で入力してください")
  .refine((v) => {
    const m = Number(v.slice(4, 6));
    return m >= 1 && m <= 12;
  }, "月は01〜12で指定してください");

/** 各種コードの入力チェック。表記ゆれを防ぐため、使える文字を英数字・ハイフン・下線に限る */
export const code = z
  .string()
  .min(1)
  .max(20)
  .regex(/^[0-9A-Za-z_-]+$/, "コードは英数字・ハイフン・アンダースコアのみ使用できます");

/** ユーザーIDの入力チェック。最大64文字までとしている */
export const userId = z.string().min(1).max(64);

/** CSVファイルの文字の種類。指定が無ければ広く使える形式にする */
export const encoding = z.enum(["utf8", "shift_jis", "euc-jp"]).default("utf8");

/** 任意入力の文字列。前後の空白を取り除き、空になった場合は「入力なし」として扱う */
export const trimmedOptional = z
  .string()
  .transform((v) => v.trim())
  .transform((v) => (v.length === 0 ? undefined : v))
  .optional();
