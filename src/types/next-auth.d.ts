import type { DefaultSession } from "next-auth";
import type { Role } from "@/shared/constants/roles";

// ログインの仕組みが元々持っている型に、このアプリ独自の項目（役割など）を足すための定義。
// これを書いておくことで、画面側で利用者の役割を取り出すときに型の誤りを検出できる。
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      authMethod: "entra" | "credentials";
    } & DefaultSession["user"];
  }

  // ID とパスワードの確認処理が返す、このアプリ独自の項目
  interface User {
    role?: Role;
    mustChangePassword?: boolean;
    authMethod?: "entra" | "credentials";
  }
}

// ログイン状態を保つ引換券の中身にも同じ項目を足す。
// 別の名前でも読み込めるが、定義の実体はこちらにあるため、こちらを対象にする。
declare module "@auth/core/jwt" {
  interface JWT {
    user_id: string;
    role: Role;
    must_change_password: boolean;
    auth_method: "entra" | "credentials";
  }
}
