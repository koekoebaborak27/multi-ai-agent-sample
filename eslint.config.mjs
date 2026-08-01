import next from "eslint-config-next";
import prettier from "eslint-config-prettier";

/** @type {import("eslint").Linter.Config[]} */
const config = [
  ...next,
  // Prettier と競合する整形系ルールを無効化（format は Prettier に一任）
  prettier,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    // jsx-a11y プラグインは eslint-config-next が既に登録済みのため、ここではルールのみ上書きする
    rules: {
      // アクセシビリティ最低限
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
    },
  },
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "current_system/**",
      "prisma/migrations/**",
      "playwright.config.ts",
      "e2e/**",
      "next-env.d.ts",
    ],
  },
];

export default config;
