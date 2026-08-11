// このモジュールを外部へ公開する窓口。
// 他の機能や画面はここに書かれているものだけを使い、モジュール内部のファイルを直接使わない。
export { auth, signIn, signOut, handlers } from "@/modules/auth/auth";
export { rbac } from "@/modules/auth/rbac";
export { authService } from "@/modules/auth/service";
export { LoginForm } from "@/modules/auth/ui/login-form";
export { PasswordChangeForm } from "@/modules/auth/ui/password-change-form";
export {
  loginWithCredentials,
  loginWithEntra,
  changePassword,
  signOutAction,
  type FormState,
} from "@/modules/auth/actions";
export type { AuthenticatedUser } from "@/modules/auth/types";
