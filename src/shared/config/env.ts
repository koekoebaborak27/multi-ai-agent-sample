import { z } from "zod";

/**
 * 環境変数の検証・型付け（§9/§10）。
 * アプリ起動時に一度だけ評価し、不正な設定を早期に検出する。
 * ※ worker(tsx) からも読まれるため `server-only` は付けない。
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => v === true || v === "true" || v === "1");

// .env の空文字（未設定プレースホルダ）は undefined 扱いにする
const optionalUrl = z.preprocess((v) => (v === "" ? undefined : v), z.string().url().optional());

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
  MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
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

/** Entra ID が設定済みか（プロバイダの出し分けに使用） */
export const isEntraConfigured =
  !!env.AUTH_MICROSOFT_ENTRA_ID_ID &&
  !!env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
  !!env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;
