"use client";

import type { NewsFormState } from "@/modules/news/actions";
import { NEWS_CATEGORY_LABELS, type NewsCategory } from "@/modules/news/types";
import { Button } from "@/shared/ui/button";

interface NewsConfirmationProps {
  state: NewsFormState;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
  onCancel: () => void;
}

// 入力された日時を確認画面向けに表示する。未入力には、公開時の扱いが分かる文言を添える。
function formatDateTime(value: string | undefined, emptyLabel: string): string {
  if (!value) return emptyLabel;
  return value.replace("T", " ");
}

// お知らせ登録の内容を確認してから実行する表示。
// 後続の更新でも使えるよう、入力値は見えない項目として実行時に送り直す。
export function NewsConfirmation({
  state,
  pending,
  formAction,
  onEdit,
  onCancel,
}: NewsConfirmationProps) {
  const category = state.category as NewsCategory | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">入力内容の確認</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          内容を確認して「実行」を押してください。
        </p>
      </div>

      <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[10rem_1fr]">
        <dt className="text-sm font-medium text-muted-foreground">処理内容</dt>
        <dd className="text-sm">{state.mode === "edit" ? "更新" : "新規登録"}</dd>
        <dt className="text-sm font-medium text-muted-foreground">タイトル</dt>
        <dd className="text-sm break-words">{state.title}</dd>
        <dt className="text-sm font-medium text-muted-foreground">カテゴリ</dt>
        <dd className="text-sm">{category ? NEWS_CATEGORY_LABELS[category] : "—"}</dd>
        <dt className="text-sm font-medium text-muted-foreground">本文</dt>
        <dd className="text-sm break-words whitespace-pre-wrap">{state.body}</dd>
        <dt className="text-sm font-medium text-muted-foreground">公開開始日時</dt>
        <dd className="text-sm">
          {formatDateTime(state.startAt, "未設定（登録した時点から公開）")}
        </dd>
        <dt className="text-sm font-medium text-muted-foreground">公開終了日時</dt>
        <dd className="text-sm">{formatDateTime(state.endAt, "未設定（期限なし）")}</dd>
        <dt className="text-sm font-medium text-muted-foreground">公開状態</dt>
        <dd className="text-sm">{state.published ? "公開" : "非公開"}</dd>
      </dl>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="title" value={state.title ?? ""} />
          <input type="hidden" name="category" value={state.category ?? ""} />
          <input type="hidden" name="body" value={state.body ?? ""} />
          <input type="hidden" name="startAt" value={state.startAt ?? ""} />
          <input type="hidden" name="endAt" value={state.endAt ?? ""} />
          {state.published ? <input type="hidden" name="published" value="on" /> : null}
          {state.mode === "edit" ? (
            <>
              <input type="hidden" name="newsId" value={state.newsId} />
              <input type="hidden" name="updatedAt" value={state.updatedAt} />
            </>
          ) : null}
          <Button type="submit" name="intent" value="execute" disabled={pending}>
            {pending ? "更新中..." : "実行"}
          </Button>
        </form>
        <Button type="button" variant="outline" onClick={onEdit} disabled={pending}>
          入力内容を修正
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
