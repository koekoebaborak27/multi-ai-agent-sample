"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { masterService } from "@/modules/master/service";
import {
  createMasterCategorySchema,
  createMasterSchema,
  parseMasterReturnTo,
  updateMasterCategorySchema,
  updateMasterSchema,
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

export interface MasterFormState {
  mode: "create" | "update";
  phase: "input" | "confirm";
  masterId?: number;
  categoryId?: number;
  code?: string;
  content?: string;
  returnTo: string;
  updatedAt?: string;
  originalCategoryId?: number;
  originalCategoryName?: string;
  originalCode?: string;
  originalContent?: string;
  error?: string;
}

async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden("この操作を行う権限がありません");
  return user;
}

/** 未選択・不正な値は入力欄へ戻さず未選択として扱う */
function toSelectedCategoryId(rawCategoryId: string): number | undefined {
  const categoryId = Number(rawCategoryId.trim());
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined;
}

export const createMasterAction = withOp(
  "master.create",
  async (_prev: MasterFormState, formData: FormData): Promise<MasterFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawCategoryId = String(formData.get("categoryId") ?? "");
    const rawCode = String(formData.get("code") ?? "");
    const rawContent = String(formData.get("content") ?? "");
    const returnTo = parseMasterReturnTo(String(formData.get("returnTo") ?? ""));
    const phase = intent === "execute" ? "confirm" : "input";
    const parsed = createMasterSchema.safeParse({
      categoryId: rawCategoryId,
      code: rawCode,
      content: rawContent,
    });

    if (!parsed.success) {
      return {
        mode: "create",
        phase,
        categoryId: toSelectedCategoryId(rawCategoryId),
        code: rawCode,
        content: rawContent,
        returnTo,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    try {
      if (intent === "confirm") {
        await masterService.assertCategoryExists(parsed.data.categoryId);
        await masterService.assertMasterCodeAvailable(parsed.data.categoryId, parsed.data.code);
        return { mode: "create", phase: "confirm", ...parsed.data, returnTo };
      }

      const master = await masterService.createMaster(parsed.data, user.id);
      revalidatePath("/master");
      redirect(`/master/${master.id}?created=1&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      if (isAppError(error)) {
        return { mode: "create", phase, ...parsed.data, returnTo, error: error.userMessage };
      }
      throw error;
    }
  },
);

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

export const updateMasterAction = withOp(
  "master.update",
  async (prev: MasterFormState, formData: FormData): Promise<MasterFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawCategoryId = String(formData.get("categoryId") ?? "");
    const rawCode = String(formData.get("code") ?? "");
    const rawContent = String(formData.get("content") ?? "");
    const returnTo = parseMasterReturnTo(String(formData.get("returnTo") ?? prev.returnTo));
    const originalCategoryId = Number(
      formData.get("originalCategoryId") ?? prev.originalCategoryId,
    );
    const originalCategoryName = String(
      formData.get("originalCategoryName") ?? prev.originalCategoryName ?? "",
    );
    const originalCode = String(formData.get("originalCode") ?? prev.originalCode ?? "");
    const originalContent = String(formData.get("originalContent") ?? prev.originalContent ?? "");
    const phase = intent === "execute" ? "confirm" : "input";

    const parsed = updateMasterSchema.safeParse({
      masterId: formData.get("masterId"),
      categoryId: rawCategoryId,
      code: rawCode,
      content: rawContent,
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        mode: "update",
        phase,
        returnTo,
        categoryId: toSelectedCategoryId(rawCategoryId),
        code: rawCode,
        content: rawContent,
        originalCategoryId,
        originalCategoryName,
        originalCode,
        originalContent,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const nextState: MasterFormState = {
      ...prev,
      mode: "update",
      phase,
      returnTo,
      masterId: parsed.data.masterId,
      categoryId: parsed.data.categoryId,
      code: parsed.data.code,
      content: parsed.data.content,
      updatedAt: parsed.data.updatedAt.toISOString(),
      originalCategoryId,
      originalCategoryName,
      originalCode,
      originalContent,
    };

    try {
      if (intent === "confirm") {
        await masterService.assertCategoryExists(parsed.data.categoryId);
        await masterService.assertMasterCodeAvailable(
          parsed.data.categoryId,
          parsed.data.code,
          parsed.data.masterId,
        );
        return { ...nextState, phase: "confirm" };
      }

      await masterService.updateMaster(parsed.data, user.id);
      revalidatePath("/master");
      revalidatePath(`/master/${parsed.data.masterId}`);
      redirect(
        `/master/${parsed.data.masterId}?updated=1&returnTo=${encodeURIComponent(returnTo)}`,
      );
    } catch (error) {
      if (isAppError(error)) {
        return { ...nextState, error: error.userMessage };
      }
      throw error;
    }
  },
  { includeArgsInSuccessLog: true },
);
