"use server";

import { revalidatePath } from "next/cache";
import { partyService } from "@/modules/party/service";
import { createPartySchema, updatePartySchema } from "@/modules/party/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

export interface PartyFormState {
  error?: string;
  success?: boolean;
}

/** VIEWER は書込不可（403）。 */
async function requireWriter(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden();
}

export const createPartyAction = withOp(
  "party.create",
  async (_prev: PartyFormState, formData: FormData): Promise<PartyFormState> => {
    await requireWriter();
    const parsed = createPartySchema.safeParse({
      name: formData.get("name"),
      kind: formData.get("kind") || undefined,
      contactInfo: formData.get("contactInfo") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await partyService.create(parsed.data);
    } catch (e) {
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/parties");
    return { success: true };
  },
);

export const updatePartyAction = withOp(
  "party.update",
  async (_prev: PartyFormState, formData: FormData): Promise<PartyFormState> => {
    await requireWriter();
    const parsed = updatePartySchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      kind: formData.get("kind") || undefined,
      contactInfo: formData.get("contactInfo") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await partyService.update(parsed.data);
    } catch (e) {
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/parties");
    return { success: true };
  },
);

export const deletePartyAction = withOp(
  "party.delete",
  async (formData: FormData): Promise<void> => {
    await requireWriter();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new AppError("VALIDATION_ERROR", 422, "契約先IDが不正です");
    await partyService.remove(id);
    revalidatePath("/parties");
  },
);
