import type { DefaultSession } from "next-auth";
import type { Role } from "@/shared/constants/roles";

// Session / JWT に独自クレームを型拡張する（§4）
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      mustChangePassword: boolean;
      authMethod: "entra" | "credentials";
    } & DefaultSession["user"];
  }

  // Credentials provider の authorize が返す独自フィールド
  interface User {
    role?: Role;
    mustChangePassword?: boolean;
    authMethod?: "entra" | "credentials";
  }
}

// JWT は @auth/core/jwt が実体（next-auth/jwt は re-export のみ）なのでこちらを拡張する
declare module "@auth/core/jwt" {
  interface JWT {
    user_id: string;
    role: Role;
    must_change_password: boolean;
    auth_method: "entra" | "credentials";
  }
}
