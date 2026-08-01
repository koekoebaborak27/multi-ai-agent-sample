// auth モジュールの公開 API（他モジュール/appはここ経由でのみ利用する）
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
