import { NextResponse } from "next/server";
import { auth } from "@/modules/auth/auth";
import { decideRedirect } from "@/modules/auth/route-guard";

/**
 * すべてのリクエストが最初に通る場所で、ログイン状態と権限を確認する。
 *
 * 判断に使う情報はログイン状態を保つ引換券だけで完結させ、データベースには問い合わせない
 * （全リクエストで問い合わせると負荷が大きくなるため）。
 *
 * 移動先を決める判断そのものは route-guard.ts に置き、ここではリクエストから必要な情報を
 * 取り出すことと、判断結果を応答の形に組み立てることだけを行う。
 * 判断部分を分けておくと、リクエストを組み立てなくても全ての分岐を試験できる。
 */
export default auth((req) => {
  const { nextUrl } = req;
  const user = req.auth?.user;

  const target = decideRedirect({
    path: nextUrl.pathname,
    isLoggedIn: !!user,
    // 保存などの処理の呼び出しは、この2つの特徴を持つリクエストとして届く
    isServerAction: req.method === "POST" && req.headers.has("next-action"),
    mustChangePassword: !!user?.mustChangePassword,
    role: user?.role ?? null,
  });

  return target ? NextResponse.redirect(new URL(target, nextUrl)) : NextResponse.next();
});

export const config = {
  // 画像やスタイルなどのファイルと、外部連携用の窓口は確認の対象外にする
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
