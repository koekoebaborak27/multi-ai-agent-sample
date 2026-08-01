import NextAuth from "next-auth";
import { buildProviders } from "@/modules/auth/providers";
import { authService } from "@/modules/auth/service";
import type { Role } from "@/shared/constants/roles";

/** Entra の id_token に含まれる主なクレーム */
interface EntraProfile {
  oid?: string;
  email?: string;
  preferred_username?: string;
  name?: string;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: buildProviders(),
  session: { strategy: "jwt", maxAge: 90 * 60 }, // 90分
  trustHost: true,
  pages: { signIn: "/login" },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // ── Entra ログイン（初回サインイン時に突合/自動プロビジョン）──
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
        // ── Credentials ログイン（authorize の戻り値）──
        token.user_id = user.id ?? "";
        token.role = (user.role ?? "VIEWER") as Role;
        token.must_change_password = user.mustChangePassword ?? false;
        token.auth_method = "credentials";
      }
      return token;
    },
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
