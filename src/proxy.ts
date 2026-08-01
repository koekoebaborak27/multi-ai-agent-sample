import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/auth";
import { ROLES } from "@/shared/constants/roles";

/**
 * 認証ガード + RBAC（§4）。
 * Next.js 16 で middleware.ts から proxy.ts に改名（Node.js ランタイムで動作）。
 * ロール判定は JWT クレームのみで完結させ、DB アクセスはしない。
 */
export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const session = req.auth;
  const isLoggedIn = !!session?.user;

  // 未ログイン: /login 以外は /login へ
  if (!isLoggedIn) {
    if (path.startsWith("/login")) return NextResponse.next();
    const url = new URL("/login", nextUrl);
    return NextResponse.redirect(url);
  }

  // ログイン済みで /login に来たらダッシュボードへ
  if (path.startsWith("/login")) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  // 初回PW変更の強制
  if (session.user.mustChangePassword && path !== "/settings/password") {
    return NextResponse.redirect(new URL("/settings/password", nextUrl));
  }

  // /admin/* は ADMIN 限定
  if (path.startsWith("/admin") && session.user.role !== ROLES.ADMIN) {
    return NextResponse.redirect(new URL("/", nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // api / 静的アセットは対象外
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
