"use server";

import { revalidatePath } from "next/cache";
import { contractService } from "@/modules/contract/service";
import { createContractSchema, updateContractSchema } from "@/modules/contract/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

export interface ContractFormState {
  error?: string;
  success?: boolean;
}

/** VIEWER は書込不可（403）。 */
async function requireWriter(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden();
}

export const createContractAction = withOp(
  "contract.create",
  async (_prev: ContractFormState, formData: FormData): Promise<ContractFormState> => {
    await requireWriter();
    const parsed = createContractSchema.safeParse({
      partyId: formData.get("partyId"),
      title: formData.get("title"),
      startDate: formData.get("startDate") || undefined,
      endDate: formData.get("endDate") || undefined,
      status: formData.get("status") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await contractService.create(parsed.data);
    } catch (e) {
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/contracts");
    return { success: true };
  },
);

export const updateContractAction = withOp(
  "contract.update",
  async (_prev: ContractFormState, formData: FormData): Promise<ContractFormState> => {
    await requireWriter();
    const parsed = updateContractSchema.safeParse({
      id: formData.get("id"),
      title: formData.get("title"),
      startDate: formData.get("startDate") || undefined,
      endDate: formData.get("endDate") || undefined,
      status: formData.get("status"),
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await contractService.update(parsed.data);
    } catch (e) {
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    revalidatePath("/contracts");
    return { success: true };
  },
);

export const deleteContractAction = withOp(
  "contract.delete",
  async (formData: FormData): Promise<void> => {
    await requireWriter();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new AppError("VALIDATION_ERROR", 422, "契約IDが不正です");
    await contractService.remove(id);
    revalidatePath("/contracts");
  },
);
