import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // NOTE: 現行 Docker イメージは node_modules 丸ごと + `next start` 方式のため
  //       `output: "standalone"` は設定しない（`next start` と併用不可・警告が出る）。
  //       standalone 化（docs/foundation_plan.md §6 B-1）の際に Dockerfile とセットで導入する。
  // pino / pg-boss など Node 専用パッケージを Server Components で使うため
  serverExternalPackages: ["pino", "pino-pretty", "pg-boss", "nodemailer"],
};

export default nextConfig;
