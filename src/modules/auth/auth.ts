import NextAuth from "next-auth";
import { buildProviders } from "@/modules/auth/providers";
import { authService } from "@/modules/auth/service";
import type { Role } from "@/shared/constants/roles";

/** Microsoft のログイン基盤から受け取る利用者情報のうち、このアプリで使う項目 */
interface EntraProfile {
  oid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

// ログインの仕組み全体の設定。
// ログイン状態はサーバー側に保存せず、利用者側が持つ引換券に必要な情報を埋め込む方式にしている。
// 引換券の有効期限は 90 分で、切れると再度ログインが必要になる。
export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 90 * 60 }, // 90分
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    // ログインが成功したときに呼ばれ、引換券へこのアプリ独自の情報（利用者ID・役割など）を追加する。
    // 画面の権限判定は毎回この情報を見て行うため、データベースへ都度問い合わせずに済む。
    async jwt({ token, user, account, profile }) {
      // Microsoft でログインした場合。
      // 初回ログイン時は、このアプリ側の利用者情報がまだ無いため、あわせて作成する。
      if (account?.provider === "microsoft-entra-id") {
        const p = (profile ?? {}) as EntraProfile;
        const externalId = p.oid ?? account.providerAccountId ?? token.sub ?? "";
        const dbUser = await authService.provisionEntraUser({
          externalId,
          email: p.email ?? p.preferred_username ?? token.email ?? null,
          name: p.name ?? token.name ?? null,
        });
        token.user_id = dbUser.id;
        token.role = dbUser.role;
        token.must_change_password = dbUser.mustChangePassword;
        token.auth_method = "entra";
      } else if (user) {
        // ID とパスワードでログインした場合。利用者の確認はすでに済んでいるので、その結果を写すだけ。
        token.user_id = user.id ?? "";
        token.role = (user.role ?? "VIEWER") as Role;
        token.must_change_password = user.mustChangePassword ?? false;
        token.auth_method = "credentials";
      }
      return token;
    },
    // 引換券に入れた独自の情報を、画面側から参照できる形に移し替える。
    // これを行わないと、画面側では利用者IDや役割を取り出せない。
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.user_id as string;
        session.user.role = token.role as Role;
        session.user.mustChangePassword = token.must_change_password as boolean;
        session.user.authMethod = token.auth_method as "entra" | "credentials";
      }
      return session;
    },
  },
});
