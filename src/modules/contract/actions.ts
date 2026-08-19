"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contractService } from "@/modules/contract/service";
import type { ContractStatus } from "@/modules/contract/types";
import { createContractSchema, parseContractReturnTo } from "@/modules/contract/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

// このファイルの各処理は、画面から送られた入力を受け取って登録・更新・削除を行う。
// 登録・更新はどちらも「入力 → 確認 → 実行」の順で進むため、1回の送信で完了させず、
// 次のどちらを行うかを画面からのintentで判断している（契約先と同じ方式）。
//   intentが"confirm": 入力内容を確認し、確認画面を表示する（まだ保存しない）
//   intentが"execute": 実際に保存し、完了後に詳細画面へ移動する

/**
 * 契約の登録・更新フォームの状態。画面と処理の間で往復する。
 * originalで始まる項目は更新前の値で、確認画面で変更前後を並べて表示するために保持する。
 * 開始日・終了日はinput type="date"の入力欄に合わせ、YYYY-MM-DD形式の文字列のまま保持する。
 * 契約先（partyId・partyName）は新規登録時に決めたら以後変更できないため、更新の実装（工程11）でも
 * originalの対比を行わない（§21.2.1）。
 */
export interface ContractFormState {
  mode: "create" | "update";
  phase: "input" | "confirm";
  id?: string;
  partyId?: string;
  partyName?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  status?: ContractStatus;
  categoryMasterId?: number;
  returnTo: string;
  updatedAt?: string;
  originalTitle?: string;
  originalStartDate?: string;
  originalEndDate?: string;
  originalStatus?: ContractStatus;
  originalCategoryMasterId?: number;
  originalCategoryLabel?: string;
  error?: string;
}

// ログインしていて、かつ登録・更新の権限を持つ利用者かどうかを確認し、その利用者を返す。
// 画面側でボタンを隠していても直接呼び出される可能性があるため、保存処理の入口で必ず確認する。
async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden();
  return user;
}

/** 選択された契約分類を数値に変換する。未選択やおかしな値は、入力欄へ戻さず未選択として扱う */
function toSelectedCategoryId(rawCategoryMasterId: string): number | undefined {
  if (!rawCategoryMasterId) return undefined;
  const id = Number(rawCategoryMasterId);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

// 契約を新規登録する。
// 確認画面の表示（intentが"confirm"）と、実際の登録（intentが"execute"）の両方をこの処理で受け持つ。
export const createContractAction = withOp(
  "contract.create",
  async (_prev: ContractFormState, formData: FormData): Promise<ContractFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawPartyId = String(formData.get("partyId") ?? "");
    const rawTitle = String(formData.get("title") ?? "");
    const rawStartDate = String(formData.get("startDate") ?? "");
    const rawEndDate = String(formData.get("endDate") ?? "");
    const rawStatus = String(formData.get("status") ?? "DRAFT");
    const rawCategoryMasterId = String(formData.get("categoryMasterId") ?? "");
    const returnTo = parseContractReturnTo(String(formData.get("returnTo") ?? ""));
    // エラーになったときに戻す画面。確認画面から実行した場合は確認画面に、
    // 入力画面から進もうとした場合は入力画面にとどめる。
    const phase = intent === "execute" ? "confirm" : "input";
    const parsed = createContractSchema.safeParse({
      partyId: rawPartyId,
      title: rawTitle,
      startDate: rawStartDate || undefined,
      endDate: rawEndDate || undefined,
      status: rawStatus || undefined,
      categoryMasterId: rawCategoryMasterId || undefined,
    });

    if (!parsed.success) {
      return {
        mode: "create",
        phase,
        partyId: rawPartyId || undefined,
        title: rawTitle,
        startDate: rawStartDate || undefined,
        endDate: rawEndDate || undefined,
        status: (rawStatus as ContractStatus) || "DRAFT",
        categoryMasterId: toSelectedCategoryId(rawCategoryMasterId),
        returnTo,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    try {
      // 確認画面を出す前に、選択した契約先が現在も存在するか、契約分類が現在も有効か先に確認しておく。
      // 確認画面で「実行」を押してから初めてエラーになるのを避けるため（§21.1.2）。
      if (intent === "confirm") {
        const partyName = await contractService.assertPartyExists(parsed.data.partyId);
        await contractService.assertCategoryValid(parsed.data.categoryMasterId);
        return {
          mode: "create",
          phase: "confirm",
          partyId: parsed.data.partyId,
          partyName,
          title: parsed.data.title,
          startDate: rawStartDate || undefined,
          endDate: rawEndDate || undefined,
          status: parsed.data.status,
          categoryMasterId: parsed.data.categoryMasterId,
          returnTo,
        };
      }

      // 登録したあと、一覧の表示内容を最新にしてから、登録した契約の詳細画面へ移動する
      const contract = await contractService.create(parsed.data, user.id);
      revalidatePath("/contracts");
      redirect(`/contracts/${contract.id}?created=1&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      // 重複や権限などの想定内のエラーは、画面にメッセージとして表示する。
      // それ以外の想定外のエラーはここで扱わず、そのまま上位へ渡してエラー画面に任せる。
      if (isAppError(error)) {
        return {
          mode: "create",
          phase,
          partyId: rawPartyId || undefined,
          title: rawTitle,
          startDate: rawStartDate || undefined,
          endDate: rawEndDate || undefined,
          status: (rawStatus as ContractStatus) || "DRAFT",
          categoryMasterId: toSelectedCategoryId(rawCategoryMasterId),
          returnTo,
          error: error.userMessage,
        };
      }
      throw error;
    }
  },
);

/**
 * 契約削除フォームの状態。画面と処理の間で往復する。
 * title・partyNameは削除対象の内容で、削除確認ダイアログの表示に使う
 * （削除確認ダイアログの実装は工程12で追加する）。
 */
export interface DeleteContractFormState {
  id?: string;
  title?: string;
  partyName?: string;
  returnTo: string;
  updatedAt?: string;
  error?: string;
}

// 契約を削除する。
// 削除確認ダイアログの「削除する」ボタンから呼ばれ、確認画面を挟まず1回の送信で完了する。
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
