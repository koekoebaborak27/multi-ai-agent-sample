"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { contractService } from "@/modules/contract/service";
import type { ContractStatus } from "@/modules/contract/types";
import {
  appendContractDeletedFlag,
  createContractSchema,
  deleteContractSchema,
  parseContractReturnTo,
  updateContractSchema,
} from "@/modules/contract/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { withOp } from "@/shared/observability/with-op";
import { Errors, isAppError } from "@/shared/errors/app-error";
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
 * 契約先（partyId・partyName）は新規登録時に決めたら以後変更できないため、更新でもoriginalの対比を
 * 行わず、現在の契約先をそのまま表示専用の値として持ち回るだけにする（§21.2.1）。
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

// 契約を更新する。
// 分類の登録と同じく確認・実行の2段階で進むほか、更新画面を開いた時点の最終更新日時（updatedAt）と
// 変更前の値（originalで始まる項目）を画面から受け取り、他の利用者との競合確認・確認画面の
// 変更前後表示に使う（§23.2）。契約先（partyId・partyName）は変更できないため、フォームからの
// 入力は受け取らず、更新画面を開いた時点の値をそのまま持ち回るだけにする。
export const updateContractAction = withOp(
  "contract.update",
  async (prev: ContractFormState, formData: FormData): Promise<ContractFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const partyId = String(formData.get("partyId") ?? prev.partyId ?? "");
    const partyName = String(formData.get("partyName") ?? prev.partyName ?? "");
    const rawTitle = String(formData.get("title") ?? "");
    const rawStartDate = String(formData.get("startDate") ?? "");
    const rawEndDate = String(formData.get("endDate") ?? "");
    const rawStatus = String(formData.get("status") ?? "DRAFT");
    const rawCategoryMasterId = String(formData.get("categoryMasterId") ?? "");
    const returnTo = parseContractReturnTo(String(formData.get("returnTo") ?? prev.returnTo));
    // 変更前の値。確認画面では入力欄が無く送信されないため、その場合は前回の状態から引き継ぐ
    const originalTitle = String(formData.get("originalTitle") ?? prev.originalTitle ?? "");
    const originalStartDate = String(
      formData.get("originalStartDate") ?? prev.originalStartDate ?? "",
    );
    const originalEndDate = String(formData.get("originalEndDate") ?? prev.originalEndDate ?? "");
    const originalStatus = String(
      formData.get("originalStatus") ?? prev.originalStatus ?? "DRAFT",
    ) as ContractStatus;
    const originalCategoryMasterIdRaw = String(
      formData.get("originalCategoryMasterId") ?? prev.originalCategoryMasterId ?? "",
    );
    const originalCategoryLabel = String(
      formData.get("originalCategoryLabel") ?? prev.originalCategoryLabel ?? "",
    );
    const phase = intent === "execute" ? "confirm" : "input";

    const parsed = updateContractSchema.safeParse({
      id: formData.get("id"),
      title: rawTitle,
      startDate: rawStartDate || undefined,
      endDate: rawEndDate || undefined,
      status: rawStatus || undefined,
      categoryMasterId: rawCategoryMasterId || undefined,
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        mode: "update",
        phase,
        returnTo,
        partyId,
        partyName,
        title: rawTitle,
        startDate: rawStartDate || undefined,
        endDate: rawEndDate || undefined,
        status: (rawStatus as ContractStatus) || "DRAFT",
        categoryMasterId: toSelectedCategoryId(rawCategoryMasterId),
        originalTitle,
        originalStartDate: originalStartDate || undefined,
        originalEndDate: originalEndDate || undefined,
        originalStatus,
        originalCategoryMasterId: toSelectedCategoryId(originalCategoryMasterIdRaw),
        originalCategoryLabel,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    // 確認画面の表示にもエラー時の再表示にも使うため、入力後の状態をここで組み立てておく
    const nextState: ContractFormState = {
      ...prev,
      mode: "update",
      phase,
      returnTo,
      id: parsed.data.id,
      partyId,
      partyName,
      title: parsed.data.title,
      startDate: rawStartDate || undefined,
      endDate: rawEndDate || undefined,
      status: parsed.data.status,
      categoryMasterId: parsed.data.categoryMasterId,
      updatedAt: parsed.data.updatedAt.toISOString(),
      originalTitle,
      originalStartDate: originalStartDate || undefined,
      originalEndDate: originalEndDate || undefined,
      originalStatus,
      originalCategoryMasterId: toSelectedCategoryId(originalCategoryMasterIdRaw),
      originalCategoryLabel,
    };

    try {
      // 確認画面を出す前に、契約分類が現在も有効か先に確認しておく
      if (intent === "confirm") {
        await contractService.assertCategoryValid(parsed.data.categoryMasterId);
        return { ...nextState, phase: "confirm" };
      }

      // 更新したあと、一覧と詳細の両方の表示内容を最新にしてから、詳細画面へ移動する
      await contractService.update(parsed.data, user.id);
      revalidatePath("/contracts");
      revalidatePath(`/contracts/${parsed.data.id}`);
      redirect(`/contracts/${parsed.data.id}?updated=1&returnTo=${encodeURIComponent(returnTo)}`);
    } catch (error) {
      if (isAppError(error)) {
        return { ...nextState, error: error.userMessage };
      }
      throw error;
    }
  },
  // 更新は「誰がいつ何を変えたか」を後から追えるようにしたいので、成功時の記録にも入力内容を残す
  { includeArgsInSuccessLog: true },
);

/**
 * 契約削除フォームの状態。画面と処理の間で往復する。
 * title・partyNameは削除対象の内容で、削除確認ダイアログの表示と、
 * ログへ「何を削除したか」を残すために画面側から渡され、そのまま引き継がれる。
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
// 更新と同じく、詳細画面を開いた時点の最終更新日時を送り、他の利用者が先に更新・削除していないか
// 確かめる（§24.2）。契約先の削除と異なり、依存関係のチェックは行わない（§00.9.1）。
export const deleteContractAction = withOp(
  "contract.delete",
  async (prev: DeleteContractFormState, formData: FormData): Promise<DeleteContractFormState> => {
    await requireWriter();
    const returnTo = parseContractReturnTo(String(formData.get("returnTo") ?? prev.returnTo));
    const parsed = deleteContractSchema.safeParse({
      id: formData.get("id"),
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        returnTo,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const nextState: DeleteContractFormState = {
      ...prev,
      returnTo,
      id: parsed.data.id,
      updatedAt: parsed.data.updatedAt.toISOString(),
    };

    try {
      // 削除したあと、一覧の表示内容を最新にしてから、削除完了の印を付けて一覧画面へ移動する
      await contractService.remove(parsed.data);
      revalidatePath("/contracts");
      redirect(appendContractDeletedFlag(returnTo));
    } catch (error) {
      if (isAppError(error)) {
        return { ...nextState, error: error.userMessage };
      }
      throw error;
    }
  },
  // 削除は元に戻せないため、「誰がいつ何を削除したか」を後から追えるようにログにも残す
  { includeArgsInSuccessLog: true },
);
