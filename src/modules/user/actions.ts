"use server";

import { revalidatePath } from "next/cache";
import { userService } from "@/modules/user/service";
import { createUserSchema, updateUserSchema } from "@/modules/user/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { ROLES } from "@/shared/constants/roles";

export interface UserFormState {
  error?: string;
  success?: boolean;
}

/** ADMIN 以外は 403（書込ガード）。 */
async function requireAdmin(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (user.role !== ROLES.ADMIN) throw Errors.forbidden();
}

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
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/admin/users");
    return { success: true };
  },
);

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
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/admin/users");
    return { success: true };
  },
);

export const deleteUserAction = withOp("user.delete", async (formData: FormData): Promise<void> => {
  await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new AppError("VALIDATION_ERROR", 422, "ユーザーIDが不正です");
  await userService.remove(userId);
  revalidatePath("/admin/users");
});
