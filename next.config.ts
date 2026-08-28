import type { NextConfig } from "next";

// 全レスポンス共通の基本的なセキュリティヘッダー。
// CSP（Content-Security-Policy）はGoogle Fonts等の許可リスト洗い出しと動作検証に
// 別途工数が必要なため、ここでは導入せずTODOへ申し送っている（docs/todo/TODO.md参照）。
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // NOTE: 現行 Docker イメージは node_modules 丸ごと + `next start` 方式のため
  //       `output: "standalone"` は設定しない（`next start` と併用不可・警告が出る）。
  //       standalone 化（docs/foundation_plan.md §6 B-1）の際に Dockerfile とセットで導入する。
  // pino / pg-boss など Node 専用パッケージを Server Components で使うため
  serverExternalPackages: ["pino", "pino-pretty", "pg-boss", "nodemailer"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
