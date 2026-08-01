import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";
import { env, isEntraConfigured } from "@/shared/config/env";
import { authService } from "@/modules/auth/service";
import { credentialsLoginSchema } from "@/modules/auth/validation";

/**
 * プロバイダ定義（§4）。Entra ID と Credentials を併置。
 * Entra は環境変数が揃っている場合のみ有効化する。
 */
export function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (isEntraConfigured) {
    providers.push(
      MicrosoftEntraID({
        clientId: env.AUTH_MICROSOFT_ENTRA_ID_ID,
        clientSecret: env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
        issuer: env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
      }),
    );
  }

  providers.push(
    Credentials({
      id: "credentials",
      name: "ID / パスワード",
      credentials: {
        userId: { label: "ユーザーID", type: "text" },
        password: { label: "パスワード", type: "password" },
      },
      authorize: async (raw) => {
        const parsed = credentialsLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        // 失敗時は service が AppError を throw（next-auth が認証エラーに変換）
        const user = await authService.verifyCredentials(parsed.data.userId, parsed.data.password);
        return {
          id: user.id,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          authMethod: "credentials",
          name: user.name ?? undefined,
          email: user.email ?? undefined,
        };
      },
    }),
  );

  return providers;
}
