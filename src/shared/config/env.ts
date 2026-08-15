import { z } from "zod";

/**
 * 環境変数を確認し、アプリで扱いやすい形にまとめる。
 *
 * 起動時に一度だけ確認することで、設定漏れや誤りを、
 * 実際にその設定を使う場面ではなく起動の時点で気付けるようにしている。
 *
 * ※ 画面側と定期実行の処理の両方から使うため、サーバー専用の印は付けない。
 */

// 環境変数は文字列でしか書けないため、"true" や "1" を「はい」として扱えるようにする
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");

// .env に項目名だけ書いて値が空のままの場合は、「設定されていない」として扱う
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

// 環境変数の一覧と、それぞれの初期値・入力チェックの定義
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL は必須です"),

  // 認証
  AUTH_SECRET: z.string().min(1).optional(),
  AUTH_URL: optionalUrl,
  AUTH_TRUST_HOST: booleanish.default(false),
  AUTH_MICROSOFT_ENTRA_ID_ID: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_SECRET: z.string().optional(),
  AUTH_MICROSOFT_ENTRA_ID_ISSUER: optionalUrl,

  // アプリ
  MAX_ATTEMPTS: z.coerce.number().int().positive().default(20),
  PAGE_SIZE: z.coerce.number().int().positive().default(30),

  // ログ
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOG_PRETTY: booleanish.default(false),

  // CSV
  CSV_DEFAULT_ENCODING: z.string().default("utf8"),

  // ストレージ（ローカル=ファイルシステム / 本番=Supabase Storage）
  STORAGE_TYPE: z.enum(["local", "supabase"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./uploads"),
  SUPABASE_URL: optionalUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().default("uploads"),
});

export type Env = z.infer<typeof envSchema>;

// 環境変数を読み込んで確認する。
// 誤りがあれば、どの項目が何の理由で駄目なのかを並べて起動を止める。
function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`環境変数の検証に失敗しました:\n${issues}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();

/**
 * Microsoft アカウントによるログインを使える状態かどうか。
 * 必要な設定が3つとも揃っているときだけ有効とし、ログイン画面の表示切り替えに使う。
 */
export const isEntraConfigured =
  !!env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  !!env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  !!env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
