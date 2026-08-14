import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import type { Provider } from "next-auth/providers";
import { env, isEntraConfigured } from "@/shared/config/env";
import { authService } from "@/modules/auth/service";
import { credentialsLoginSchema } from "@/modules/auth/validation";

/**
 * 利用できるログイン方法の一覧を組み立てる。
 * ID とパスワードによるログインは常に使える。
 * Microsoft アカウントによるログインは案件によって使う・使わないが分かれるため、
 * 必要な設定が環境変数に揃っているときだけ選べるようにしている。
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
      // 入力された ID とパスワードが正しいかを確かめ、正しければ利用者の情報を返す。
      // 返した内容が、ログイン状態を保つ引換券のもとになる。
      authorize: async (raw) => {
        const parsed = credentialsLoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        // ID やパスワードが違う場合、この中でエラーが発生し、ログイン失敗として扱われる
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
