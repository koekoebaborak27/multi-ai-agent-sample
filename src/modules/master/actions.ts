"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { masterService } from "@/modules/master/service";
import {
  createMasterCategorySchema,
  updateMasterCategorySchema,
} from "@/modules/master/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Errors, isAppError } from "@/shared/errors/app-error";
import { withOp } from "@/shared/observability/with-op";

export interface MasterCategoryFormState {
  mode: "create" | "update";
  phase: "input" | "confirm";
  categoryId?: number;
  code?: string;
  originalName?: string;
  name?: string;
  masterCount?: number;
  updatedAt?: string;
  error?: string;
}

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden("この操作を行う権限がありません");
  return user;
}

export const createMasterCategoryAction = withOp(
  "master.category.create",
  async (_prev: MasterCategoryFormState, formData: FormData): Promise<MasterCategoryFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawName = String(formData.get("name") ?? "");
    const parsed = createMasterCategorySchema.safeParse({ name: rawName });

    if (!parsed.success) {
      return {
        mode: "create",
        phase: intent === "execute" ? "confirm" : "input",
        name: rawName,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    try {
      if (intent === "confirm") {
        await masterService.assertCategoryNameAvailable(parsed.data.name);
        return { mode: "create", phase: "confirm", name: parsed.data.name };
      }

      const category = await masterService.createCategory(parsed.data, user.id);
      revalidatePath("/master/categories");
      redirect(`/master/categories/${category.id}?created=1`);
    } catch (error) {
      if (isAppError(error)) {
        return {
          mode: "create",
          phase: intent === "execute" ? "confirm" : "input",
          name: parsed.data.name,
          error: error.userMessage,
        };
      }
      throw error;
    }
  },
);

export const updateMasterCategoryAction = withOp(
  "master.category.update",
  async (prev: MasterCategoryFormState, formData: FormData): Promise<MasterCategoryFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawName = String(formData.get("name") ?? "");
    const parsed = updateMasterCategorySchema.safeParse({
      categoryId: formData.get("categoryId"),
      name: rawName,
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        mode: "update",
        phase: intent === "execute" ? "confirm" : "input",
        name: rawName,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const nextState: MasterCategoryFormState = {
      ...prev,
      mode: "update",
      phase: intent === "execute" ? "confirm" : "input",
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      updatedAt: parsed.data.updatedAt.toISOString(),
    };

    try {
      if (intent === "confirm") {
        await masterService.assertCategoryNameAvailable(parsed.data.name, parsed.data.categoryId);
        return { ...nextState, phase: "confirm" };
      }

      await masterService.updateCategory(parsed.data, user.id);
      revalidatePath("/master/categories");
      revalidatePath(`/master/categories/${parsed.data.categoryId}`);
      redirect(`/master/categories/${parsed.data.categoryId}?updated=1`);
    } catch (error) {
      if (isAppError(error)) {
        return { ...nextState, error: error.userMessage };
      }
      throw error;
    }
  },
  { includeArgsInSuccessLog: true },
);
