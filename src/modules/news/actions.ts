"use server";

import { revalidatePath } from "next/cache";
import { newsService } from "@/modules/news/service";
import type { NewsFeedPage } from "@/modules/news/types";
import { createNewsSchema, deleteNewsSchema, updateNewsSchema } from "@/modules/news/validation";
import { getCurrentUser } from "@/shared/auth/session";
import { canWrite } from "@/shared/constants/roles";
import { Errors, isAppError } from "@/shared/errors/app-error";
import { withOp } from "@/shared/observability/with-op";

/** 登録・更新ポップアップで共通に持ち回る入力・確認状態。 */
interface NewsFormStateBase {
  phase: "input" | "confirm";
  title?: string;
  category?: string;
  body?: string;
  startAt?: string;
  endAt?: string;
  published?: boolean;
  error?: string;
  success?: boolean;
}

/** お知らせ登録ポップアップの入力・確認状態。画面とServer Actionの間で入力値を保つ */
export interface NewsCreateFormState extends NewsFormStateBase {
  mode: "create";
}

/** お知らせ更新ポップアップの入力・確認状態。更新対象と表示時点の更新日時も保持する */
export interface NewsEditFormState extends NewsFormStateBase {
  mode: "edit";
  newsId: string;
  updatedAt: string;
}

/** 登録・更新の確認画面で共通に使うフォーム状態。 */
export type NewsFormState = NewsCreateFormState | NewsEditFormState;

/** お知らせ削除ダイアログの状態。削除対象の表示内容と実行結果を画面とServer Actionの間で保つ。 */
export interface DeleteNewsFormState {
  newsId: string;
  title: string;
  categoryLabel: string;
  updatedAt: string;
  error?: string;
  success?: boolean;
}

// お知らせを書き込める利用者かを確認して返す。
// 画面上でボタンを隠していても直接Server Actionを実行できるため、入口で必ず確認する。
async function requireWriter() {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthorized();
  if (!canWrite(user.role)) throw Errors.forbidden("この操作を行う権限がありません");
  return user;
}

// フォームの値を、入力エラー時にもそのまま表示へ戻せる形で読み取る。
function readCreateNewsForm(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    category: String(formData.get("category") ?? ""),
    body: String(formData.get("body") ?? ""),
    startAt: String(formData.get("startAt") ?? ""),
    endAt: String(formData.get("endAt") ?? ""),
    // チェックを外したcheckboxは値自体を送らないため、未送信をfalseとして扱う。
    published: formData.get("published") === "on",
  };
}

// 更新フォームの値を、確認画面の実行時にも同じ内容で読み取る。
function readUpdateNewsForm(formData: FormData) {
  return {
    ...readCreateNewsForm(formData),
    newsId: String(formData.get("newsId") ?? ""),
    updatedAt: String(formData.get("updatedAt") ?? ""),
  };
}

// お知らせを新規登録する。確認表示と実際の登録をintentで分け、
// 確認表示へ進む段階でもサーバー側で入力を検証する。
export const createNewsAction = withOp(
  "news.create",
  async (_prev: NewsCreateFormState, formData: FormData): Promise<NewsCreateFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const raw = readCreateNewsForm(formData);
    const phase = intent === "execute" ? "confirm" : "input";
    const parsed = createNewsSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        mode: "create",
        phase,
        ...raw,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const state = {
      mode: "create" as const,
      phase,
      title: parsed.data.title,
      category: parsed.data.category,
      body: parsed.data.body,
      startAt: raw.startAt,
      endAt: raw.endAt,
      published: parsed.data.published,
    } satisfies NewsCreateFormState;

    try {
      if (intent === "confirm") return { ...state, phase: "confirm" };

      await newsService.createNews(parsed.data, user.id);
      // Dialogを閉じた後の一覧とトップ画面を最新の内容にする。
      revalidatePath("/news");
      revalidatePath("/");
      return { ...state, phase: "confirm", success: true };
    } catch (error) {
      if (isAppError(error)) return { ...state, error: error.userMessage };
      throw error;
    }
  },
);

// お知らせを更新する。実行時は、入力内容を検証する前に対象の存在と更新競合を確認する。
// 古い画面で検証だけを繰り返させないため、設計書§22.1.4の順序を守る。
export const updateNewsAction = withOp(
  "news.update",
  async (_prev: NewsEditFormState, formData: FormData): Promise<NewsEditFormState> => {
    const user = await requireWriter();
    const intent = formData.get("intent") === "execute" ? "execute" : "confirm";
    const raw = readUpdateNewsForm(formData);
    const phase = intent === "execute" ? "confirm" : "input";
    const state = {
      mode: "edit" as const,
      phase,
      ...raw,
      published: raw.published,
    } satisfies NewsEditFormState;

    try {
      if (intent === "execute") {
        // updatedAtは入力値の検証より先に競合検知へ使うため、日時として読めない場合だけ入力エラーにする。
        const expectedUpdatedAt = new Date(raw.updatedAt);
        if (!raw.newsId || Number.isNaN(expectedUpdatedAt.getTime())) {
          return { ...state, error: "入力内容を確認してください" };
        }
        await newsService.assertNewsUnchanged(raw.newsId, expectedUpdatedAt);
      }

      const parsed = updateNewsSchema.safeParse(raw);
      if (!parsed.success) {
        return {
          ...state,
          error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
        };
      }

      const nextState = {
        ...state,
        title: parsed.data.title,
        category: parsed.data.category,
        body: parsed.data.body,
        startAt: raw.startAt,
        endAt: raw.endAt,
        published: parsed.data.published,
        updatedAt: parsed.data.updatedAt.toISOString(),
      } satisfies NewsEditFormState;

      if (intent === "confirm") return { ...nextState, phase: "confirm" };

      await newsService.updateNews(parsed.data, user.id);
      // Dialogを閉じた後の一覧とトップ画面を最新の内容にする。
      revalidatePath("/news");
      revalidatePath("/");
      return { ...nextState, phase: "confirm", success: true };
    } catch (error) {
      if (isAppError(error)) return { ...state, error: error.userMessage };
      throw error;
    }
  },
);

// お知らせを削除する。画面に表示したタイトルも入力に含め、物理削除後にも操作内容をログへ残せるようにする。
export const deleteNewsAction = withOp(
  "news.delete",
  async (prev: DeleteNewsFormState, formData: FormData): Promise<DeleteNewsFormState> => {
    await requireWriter();
    const parsed = deleteNewsSchema.safeParse({
      newsId: formData.get("newsId"),
      updatedAt: formData.get("updatedAt"),
    });

    if (!parsed.success) {
      return {
        ...prev,
        error: parsed.error.issues[0]?.message ?? "入力内容を確認してください",
      };
    }

    const nextState: DeleteNewsFormState = {
      ...prev,
      newsId: parsed.data.newsId,
      updatedAt: parsed.data.updatedAt.toISOString(),
    };

    try {
      await newsService.deleteNews(parsed.data);
      // 削除後に管理一覧とトップ画面の両方から対象を消すため、表示を最新化する。
      revalidatePath("/news");
      revalidatePath("/");
      return { ...nextState, success: true };
    } catch (error) {
      if (isAppError(error)) return { ...nextState, error: error.userMessage };
      throw error;
    }
  },
  // 物理削除後にも何を削除したかを追えるよう、タイトルを含む入力を成功ログへ残す。
  { includeArgsInSuccessLog: true },
);

// トップ画面で、表示済み件数の次から公開中のお知らせを追加取得する。
// 閲覧はログイン済みの全ロールに許可されており、ログイン確認はproxyで済んでいるため、書き込み権限は確認しない。
export const loadMoreNewsAction = withOp(
  "news.load-more",
  async (offset: number): Promise<NewsFeedPage> => newsService.listPublished(offset),
);
