import { defineConfig, devices } from "@playwright/test";

/**
 * E2E 雛形（後続で拡充）。実行には @playwright/test の導入が必要。
 *   pnpm add -D @playwright/test && pnpm exec playwright install
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
