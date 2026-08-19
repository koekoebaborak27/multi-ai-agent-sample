"use server";

import { revalidatePath } from "next/cache";
import { partyService } from "@/modules/party/service";
import { createPartySchema, updatePartySchema } from "@/modules/party/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

/** 契約先フォームの状態。エラーがあればメッセージを、成功したらその印を入れて画面へ返す */
export interface PartyFormState {
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

// 契約先を新規登録する。
export const createPartyAction = withOp(
  "party.create",
  async (_prev: PartyFormState, formData: FormData): Promise<PartyFormState> => {
    await requireWriter();
    const parsed = createPartySchema.safeParse({
      name: formData.get("name"),
      companyTypeMasterId: formData.get("companyTypeMasterId") || undefined,
      contactInfo: formData.get("contactInfo") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await partyService.create(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/parties");
    return { success: true };
  },
);

// 契約先を更新する。
export const updatePartyAction = withOp(
  "party.update",
  async (_prev: PartyFormState, formData: FormData): Promise<PartyFormState> => {
    await requireWriter();
    const parsed = updatePartySchema.safeParse({
      id: formData.get("id"),
      name: formData.get("name"),
      companyTypeMasterId: formData.get("companyTypeMasterId") || undefined,
      contactInfo: formData.get("contactInfo") || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "入力内容に誤りがあります" };
    }
    try {
      await partyService.update(parsed.data);
    } catch (e) {
      // 想定内のエラーは画面にメッセージとして表示し、それ以外はそのまま上位へ渡す
      if (isAppError(e)) return { error: e.userMessage };
      throw e;
    }
    // 一覧の表示内容を最新にしてから、成功を画面へ伝える
    revalidatePath("/parties");
    return { success: true };
  },
);

// 契約先を削除する。
// 登録・更新と違い画面へ状態を返さないため、失敗した場合はエラー画面が表示される。
export const deletePartyAction = withOp(
  "party.delete",
  async (formData: FormData): Promise<void> => {
    await requireWriter();
    const id = String(formData.get("id") ?? "");
    if (!id) throw new AppError("VALIDATION_ERROR", 422, "契約先IDが不正です");
    await partyService.remove(id);
    // 削除した契約先が一覧に残らないよう、表示内容を最新にする
    revalidatePath("/parties");
  },
);
