"use server";

import { revalidatePath } from "next/cache";
import { contractService } from "@/modules/contract/service";
import { createContractSchema, updateContractSchema } from "@/modules/contract/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

/** 契約フォームの状態。エラーがあればメッセージを、成功したらその印を入れて画面へ返す */
export interface ContractFormState {
  error?: string;
  success?: boolean;
}

// ログインしていて、かつ登録・更新の権限を持つ利用者かどうかを確認する。
// 画面側でボタンを隠していても直接呼び出される可能性があるため、保存処理の入口で必ず確認する。
async function requireWriter(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden();
}

// 契約を新規登録する。
// マスタと違い確認画面を挟まないため、入力チェックを通ればそのまま登録する。
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
      categoryMasterId: formData.get("categoryMasterId") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await contractService.create(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/contracts");
    return { success: true };
  },
);

// 契約を更新する。契約先は変更できないため、フォームからも受け取らない。
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
      categoryMasterId: formData.get("categoryMasterId") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await contractService.update(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/contracts");
    return { success: true };
  },
);

// 契約を削除する。
// 登録・更新と違い画面へ状態を返さないため、失敗した場合はエラー画面が表示される。
export const deleteContractAction = withOp(
  "contract.delete",
  async (formData: FormData): Promise<void> => {
    await requireWriter();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new AppError("VALIDATION_ERROR", 422, "契約IDが不正です");
    await contractService.remove(id);
    // 削除した契約が一覧に残らないよう、表示内容を最新にする
    revalidatePath("/contracts");
  },
);
