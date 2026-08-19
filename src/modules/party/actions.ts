"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { partyService } from "@/modules/party/service";
import { createPartySchema, parsePartyReturnTo } from "@/modules/party/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { AppError, Errors, isAppError } from "@/shared/errors/app-error";
import { canWrite } from "@/shared/constants/roles";

// このファイルの各処理は、画面から送られた入力を受け取って登録・更新・削除を行う。
// 登録・更新はどちらも「入力 → 確認 → 実行」の順で進むため、1回の送信で完了させず、
// 次のどちらを行うかを画面からの intent で判断している（マスタ機能と同じ方式）。
//   intent が "confirm": 入力内容を確認し、確認画面を表示する（まだ保存しない）
//   intent が "execute": 実際に保存し、完了後に詳細画面へ移動する

/**
 * 契約先の登録・更新フォームの状態。画面と処理の間で往復する。
 * original で始まる項目は更新前の値で、確認画面で変更前後を並べて表示するために保持する
 * （更新の実装は工程5で追加する。現時点ではmode="update"は使わない）。
 */
export interface PartyFormState {
  mode: "create" | "update";
  phase: "input" | "confirm";
  id?: string;
  name?: string;
  companyTypeMasterId?: number;
  contactInfo?: string;
  returnTo: string;
  updatedAt?: string;
  originalName?: string;
  originalCompanyTypeMasterId?: number;
  originalCompanyTypeLabel?: string;
  originalContactInfo?: string;
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

/** 選択された分類を数値に変換する。未選択やおかしな値は、入力欄へ戻さず未選択として扱う */
function toSelectedCompanyTypeId(rawCompanyTypeId: string): number | undefined {
  if (!rawCompanyTypeId) return undefined;
  const id = Number(rawCompanyTypeId);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

// 契約先を新規登録する。
// 確認画面の表示（intentが"confirm"）と、実際の登録（intentが"execute"）の両方をこの処理で受け持つ。
export const createPartyAction = withOp(
  "party.create",
  async (_prev: PartyFormState, formData: FormData): Promise<PartyFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawName = String(formData.get("name") ?? "");
    const rawCompanyTypeMasterId = String(formData.get("companyTypeMasterId") ?? "");
    const rawContactInfo = String(formData.get("contactInfo") ?? "");
    const returnTo = parsePartyReturnTo(String(formData.get("returnTo") ?? ""));
    // エラーになったときに戻す画面。確認画面から実行した場合は確認画面に、
    // 入力画面から進もうとした場合は入力画面にとどめる。
    const phase = intent === "execute" ? "confirm" : "input";
    const parsed = createPartySchema.safeParse({
      name: rawName,
      companyTypeMasterId: rawCompanyTypeMasterId || undefined,
      contactInfo: rawContactInfo || undefined,
    });

    if (!parsed.success) {
      return {
        mode: "create",
        phase,
        name: rawName,
        companyTypeMasterId: toSelectedCompanyTypeId(rawCompanyTypeMasterId),
        contactInfo: rawContactInfo,
        returnTo,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    try {
      // 確認画面を出す前に、選択した契約先分類が現在も有効か先に確認しておく。
      // 確認画面で「実行」を押してから初めてエラーになるのを避けるため。
      if (intent === "confirm") {
        await partyService.assertCompanyTypeValid(parsed.data.companyTypeMasterId);
        return { mode: "create", phase: "confirm", ...parsed.data, returnTo };
      }

      // 登録したあと、一覧の表示内容を最新にしてから、登録した契約先の詳細画面へ移動する
      const party = await partyService.create(parsed.data, user.id);
      revalidatePath("/parties");
      redirect(`/parties/${party.id}?created=1&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      // 重複や権限などの想定内のエラーは、画面にメッセージとして表示する。
      // それ以外の想定外のエラーはここで扱わず、そのまま上位へ渡してエラー画面に任せる。
      if (isAppError(error)) {
        return { mode: "create", phase, ...parsed.data, returnTo, error: error.userMessage };
      }
      throw error;
    }
  },
);

/**
 * 契約先削除フォームの状態。画面と処理の間で往復する。
 * name・companyTypeLabelは削除対象の内容で、削除確認ダイアログの表示に使う
 * （削除確認ダイアログの実装は工程6で追加する）。
 */
export interface DeletePartyFormState {
  id?: string;
  name?: string;
  companyTypeLabel?: string;
  returnTo: string;
  updatedAt?: string;
  error?: string;
}

// 契約先を削除する。
// 削除確認ダイアログの「削除する」ボタンから呼ばれ、確認画面を挟まず1回の送信で完了する。
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
