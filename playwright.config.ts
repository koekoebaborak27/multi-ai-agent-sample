import { defineConfig, devices } from "@playwright/test";

// .env.exampleのテスト用アカウント（SEED_ADMIN_PASSWORD等）を環境変数として読み込む。
try {
  process.loadEnvFile(".env.example");
} catch {
  // ファイルが無い場合はスキップする
}

/**
 * E2E 雛形（後続で拡充）。実行には @playwright/test の導入が必要。
 *   pnpm add -D @playwright/test && pnpm exec playwright install
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on",
    video: "on",
  },
  // Argon2idによるパスワード検証に時間がかかるため、既定の5秒より長めに待つ
  expect: { timeout: 15000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
