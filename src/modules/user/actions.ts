"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/modules/user/service";
import { createUserSchema, updateUserSchema } from "@/modules/user/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { ROLES } from "@/shared/constants/roles";

/** 利用者フォームの状態。エラーがあればメッセージを、成功したらその印を入れて画面へ返す */
export interface UserFormState {
  error?: string;
  success?: boolean;
}

// 管理者かどうかを確認する。
// 利用者の管理は他の機能と違い、登録・更新の権限があるだけでは足りず、管理者だけが行える。
async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (user.role !== ROLES.ADMIN) throw Errors.forbidden();
}

// 利用者を新規登録する。
export const createUserAction = withOp(
  "user.create",
  async (_prev: UserFormState, formData: FormData): Promise<UserFormState> => {
    await requireAdmin();
    const parsed = createUserSchema.safeParse({
      userId: formData.get("userId"),
      displayName: formData.get("displayName") || undefined,
      email: formData.get("email") || undefined,
      role: formData.get("role"),
      password: formData.get("password") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await userService.create(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/admin/users");
    return { success: true };
  },
);

// 利用者の表示名と役割を更新する。
export const updateUserAction = withOp(
  "user.update",
  async (_prev: UserFormState, formData: FormData): Promise<UserFormState> => {
    await requireAdmin();
    const parsed = updateUserSchema.safeParse({
      userId: formData.get("userId"),
      displayName: formData.get("displayName") || undefined,
      role: formData.get("role"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await userService.update(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/admin/users");
    return { success: true };
  },
);

// 利用者を削除する。データそのものは消さず、削除済みの印を付けるだけ。
export const deleteUserAction = withOp("user.delete", async (formData: FormData): Promise<void> => {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new AppError("VALIDATION_ERROR", 422, "ユーザーIDが不正です");
  await userService.remove(userId);
  // 削除した利用者が一覧に残らないよう、表示内容を最新にする
  revalidatePath("/admin/users");
});
