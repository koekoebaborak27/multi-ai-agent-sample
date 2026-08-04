import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/auth";
import { decideRedirect } from "@/modules/auth/route-guard";

/**
 * 認証ガード + RBAC（§4）。
 * Next.js 16 で middleware.ts から proxy.ts に改名（Node.js ランタイムで動作）。
 * ロール判定は JWT クレームのみで完結させ、DB アクセスはしない。
 *
 * 判定そのものは route-guard.ts の純粋関数に委ね、ここはリクエストの読み取りと
 * レスポンスの組み立てに徹する（分岐の網羅テストを NextRequest 抜きで書けるようにするため）。
 */
export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;

  const target = decideRedirect({
    path: nextUrl.pathname,
    isLoggedIn: !!user,
    // Server Action は POST + next-action ヘッダで届く
    isServerAction: req.method === "POST" && req.headers.has("next-action"),
    mustChangePassword: !!user?.mustChangePassword,
    role: user?.role ?? null,
  });

  return target ? NextResponse.redirect(new URL(target, nextUrl)) : NextResponse.next();
});

export const config = {
  // api / 静的アセットは対象外
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
