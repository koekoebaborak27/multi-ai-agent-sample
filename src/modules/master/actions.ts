"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { masterService } from "@/modules/master/service";
import {
  createMasterCategorySchema,
  createMasterSchema,
  deleteMasterSchema,
  parseMasterReturnTo,
  updateMasterCategorySchema,
  updateMasterSchema,
} from "@/modules/master/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Errors, isAppError } from "@/shared/errors/app-error";
import { withOp } from "@/shared/observability/with-op";

// このファイルの各処理は、画面から送られた入力を受け取って登録・更新を行う。
// マスタの登録・更新はどれも「入力 → 確認 → 実行」の順で進むため、
// 1 回の送信で完了させず、次のどちらを行うかを画面からの intent で判断している。
//   intent が "confirm": 入力内容を確認し、確認画面を表示する（まだ保存しない）
//   intent が "execute": 実際に保存し、完了後に詳細画面へ移動する
// 入力に誤りがあった場合は、入力し直せるよう入力内容を保持したまま画面へ返す。

/** マスタ分類の登録・更新フォームの状態。画面と処理の間で往復する */
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

/**
 * マスタの登録・更新フォームの状態。画面と処理の間で往復する。
 * original で始まる項目は更新前の値で、確認画面で変更前後を並べて表示するために保持する。
 */
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

// ログインしていて、かつ登録・更新の権限を持つ利用者かどうかを確認し、その利用者を返す。
// 画面側でボタンを隠していても直接呼び出される可能性があるため、保存処理の入口で必ず確認する。
async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden("この操作を行う権限がありません");
  return user;
}

/** 選択された分類を数値に変換する。未選択やおかしな値は、入力欄へ戻さず未選択として扱う */
function toSelectedCategoryId(rawCategoryId: string): number | undefined {
  const categoryId = Number(rawCategoryId.trim());
  return Number.isInteger(categoryId) && categoryId > 0 ? categoryId : undefined;
}

/**
 * 一覧画面へ戻るURLに、削除完了を知らせる印（deleted=1）を付け加える。
 * 検索条件には含めないため、一覧画面側はこの印だけを見てトーストを表示し、条件には引き継がない。
 */
function appendDeletedFlag(returnTo: string): string {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}deleted=1`;
}

// マスタを新規登録する。
// 確認画面の表示（intent が "confirm"）と、実際の登録（intent が "execute"）の両方をこの処理で受け持つ。
// withOp で包むことで、処理の開始・終了・失敗の記録が自動的に残る。
export const createMasterAction = withOp(
  "master.create",
  async (_prev: MasterFormState, formData: FormData): Promise<MasterFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawCategoryId = String(formData.get("categoryId") ?? "");
    const rawCode = String(formData.get("code") ?? "");
    const rawContent = String(formData.get("content") ?? "");
    const returnTo = parseMasterReturnTo(String(formData.get("returnTo") ?? ""));
    // エラーになったときに戻す画面。確認画面から実行した場合は確認画面に、
    // 入力画面から進もうとした場合は入力画面にとどめる。
    const phase = intent === "execute" ? "confirm" : "input";
    const parsed = createMasterSchema.safeParse({
      categoryId: rawCategoryId,
      code: rawCode,
      content: rawContent,
    });

    // 入力に誤りがあれば、入力し直せるよう入力内容をそのまま画面へ返す
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
      // 確認画面を出す前に、分類の存在とコードの重複だけ先に確認しておく。
      // 確認画面で「はい」を押してから初めてエラーになるのを避けるため。
      if (intent === "confirm") {
        await masterService.assertCategoryExists(parsed.data.categoryId);
        await masterService.assertMasterCodeAvailable(parsed.data.categoryId, parsed.data.code);
        return { mode: "create", phase: "confirm", ...parsed.data, returnTo };
      }

      // 登録したあと、一覧の表示内容を最新にしてから、登録したマスタの詳細画面へ移動する
      const master = await masterService.createMaster(parsed.data, user.id);
      revalidatePath("/master");
      redirect(`/master/${master.id}?created=1&returnTo=${encodeURIComponent(returnTo)}`);
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

// マスタ分類を新規登録する（マスタの新規登録と同じ「確認 → 実行」の流れ）。
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
      // 確認画面を出す前に、同じ名前の分類が無いことを先に確認しておく
      if (intent === "confirm") {
        await masterService.assertCategoryNameAvailable(parsed.data.name);
        return { mode: "create", phase: "confirm", name: parsed.data.name };
      }

      // 登録したあと、一覧の表示内容を最新にしてから、登録した分類の詳細画面へ移動する
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

// マスタ分類を更新する。
// 新規登録と違い、更新画面を開いた時点の最終更新日時（updatedAt）を画面から受け取り、
// 他の利用者が先に更新していないかの判断に使う。
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

    // 確認画面の表示にもエラー時の再表示にも使うため、入力後の状態をここで組み立てておく。
    // prev を引き継ぐのは、コード・変更前の名前など画面の表示に必要で
    // フォームからは送られてこない項目を保つため。
    const nextState: MasterCategoryFormState = {
      ...prev,
      mode: "update",
      phase: intent === "execute" ? "confirm" : "input",
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      updatedAt: parsed.data.updatedAt.toISOString(),
    };

    try {
      // 確認画面を出す前に、変更後の名前が他の分類と重複しないことを先に確認しておく
      if (intent === "confirm") {
        await masterService.assertCategoryNameAvailable(parsed.data.name, parsed.data.categoryId);
        return { ...nextState, phase: "confirm" };
      }

      // 更新したあと、一覧と詳細の両方の表示内容を最新にしてから、詳細画面へ移動する
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
  // 更新は「誰がいつ何を変えたか」を後から追えるようにしたいので、成功時の記録にも入力内容を残す
  { includeArgsInSuccessLog: true },
);

// マスタを更新する。
// 分類の更新と同じく最終更新日時を受け取るほか、確認画面で変更前後を並べて表示するため、
// 変更前の値（originalCategoryId など）も画面から受け取って持ち回る。
export const updateMasterAction = withOp(
  "master.update",
  async (prev: MasterFormState, formData: FormData): Promise<MasterFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const rawCategoryId = String(formData.get("categoryId") ?? "");
    const rawCode = String(formData.get("code") ?? "");
    const rawContent = String(formData.get("content") ?? "");
    const returnTo = parseMasterReturnTo(String(formData.get("returnTo") ?? prev.returnTo));
    // 変更前の値。確認画面では入力欄が無く送信されないため、その場合は前回の状態から引き継ぐ
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

    // 確認画面の表示にもエラー時の再表示にも使うため、入力後の状態をここで組み立てておく
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
      // 確認画面を出す前に、分類の存在とコードの重複を先に確認しておく。
      // 自分自身のコードは重複と見なさないよう、対象のマスタを除外して確認する。
      if (intent === "confirm") {
        await masterService.assertCategoryExists(parsed.data.categoryId);
        await masterService.assertMasterCodeAvailable(
          parsed.data.categoryId,
          parsed.data.code,
          parsed.data.masterId,
        );
        return { ...nextState, phase: "confirm" };
      }

      // 更新したあと、一覧と詳細の両方の表示内容を最新にしてから、詳細画面へ移動する
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
  // 更新は「誰がいつ何を変えたか」を後から追えるようにしたいので、成功時の記録にも入力内容を残す
  { includeArgsInSuccessLog: true },
);

/**
 * マスタ削除フォームの状態。画面と処理の間で往復する。
 * categoryName・code・content は削除対象の内容で、削除確認ダイアログの表示と、
 * ログへ「何を削除したか」を残すために画面側から渡され、そのまま引き継がれる。
 */
export interface DeleteMasterFormState {
  masterId?: number;
  categoryName?: string;
  code?: string;
  content?: string;
  returnTo: string;
  updatedAt?: string;
  error?: string;
}

// マスタを削除する。
// 削除確認ダイアログの「削除する」ボタンから呼ばれ、確認画面を挟まず1回の送信で完了する。
// 更新と同じく、詳細画面を開いた時点の最終更新日時を送り、他の利用者が先に更新・削除していないか確かめる。
export const deleteMasterAction = withOp(
  "master.delete",
  async (prev: DeleteMasterFormState, formData: FormData): Promise<DeleteMasterFormState> => {
    await requireWriter();
    const returnTo = parseMasterReturnTo(String(formData.get("returnTo") ?? prev.returnTo));
    const parsed = deleteMasterSchema.safeParse({
      masterId: formData.get("masterId"),
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        returnTo,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const nextState: DeleteMasterFormState = {
      ...prev,
      returnTo,
      masterId: parsed.data.masterId,
      updatedAt: parsed.data.updatedAt.toISOString(),
    };

    try {
      // 削除したあと、一覧の表示内容を最新にしてから、削除完了の印を付けて一覧画面へ移動する
      await masterService.deleteMaster(parsed.data);
      revalidatePath("/master");
      redirect(appendDeletedFlag(returnTo));
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
