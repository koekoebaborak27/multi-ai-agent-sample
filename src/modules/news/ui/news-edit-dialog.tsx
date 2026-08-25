"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { updateNewsAction, type NewsEditFormState } from "@/modules/news/actions";
import {
  NEWS_CATEGORIES,
  NEWS_CATEGORY_LABELS,
  type NewsCategory,
  type NewsSummary,
} from "@/modules/news/types";
import { NewsConfirmation } from "@/modules/news/ui/news-confirmation";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { toast } from "@/shared/ui/toaster";

// Dateを日時入力欄が受け取れる日本時間の文字列へ変換する。
// UTCのままISO文字列を渡すと、利用者が見た時刻が9時間ずれてしまうためである。
function toDateTimeLocalValue(value: Date | null): string {
  if (!value) return "";
  const date = new Date(value.getTime() + 9 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 16);
}

// 一覧の1行を編集フォームの初期状態へ変換する。
function toInitialState(news: NewsSummary): NewsEditFormState {
  return {
    mode: "edit",
    phase: "input",
    newsId: news.id,
    title: news.title,
    category: news.category,
    body: news.body,
    startAt: toDateTimeLocalValue(news.startAt),
    endAt: toDateTimeLocalValue(news.endAt),
    published: news.published,
    updatedAt: news.updatedAt.toISOString(),
  };
}

interface NewsEditDialogFormProps {
  initialState: NewsEditFormState;
  onClose: () => void;
}

// お知らせの入力・確認・更新をポップアップ内で切り替える本体。
function NewsEditDialogForm({ initialState, onClose }: NewsEditDialogFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateNewsAction, initialState);
  const [editingState, setEditingState] = useState<NewsEditFormState | null>(null);

  useEffect(() => {
    if (!state.success) return;
    toast.success("お知らせを更新しました");
    onClose();
    // URLの検索条件・ページ・並び順を変えずに、一覧だけを再読み込みする。
    router.refresh();
  }, [onClose, router, state.success]);

  if (state.phase === "confirm" && editingState !== state) {
    return (
      <NewsConfirmation
        state={state}
        pending={pending}
        formAction={formAction}
        onEdit={() => setEditingState(state)}
        onCancel={onClose}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="newsId" value={state.newsId} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <div className="space-y-2">
        <Label htmlFor={`news-title-${state.newsId}`}>タイトル</Label>
        <Input
          id={`news-title-${state.newsId}`}
          name="title"
          defaultValue={state.title ?? ""}
          required
          maxLength={200}
          aria-invalid={state.error ? true : undefined}
        />
        <p className="text-sm text-muted-foreground">1文字以上200文字以内で入力してください。</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`news-category-${state.newsId}`}>カテゴリ</Label>
        <select
          id={`news-category-${state.newsId}`}
          name="category"
          defaultValue={state.category ?? ""}
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          aria-invalid={state.error ? true : undefined}
        >
          {NEWS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {NEWS_CATEGORY_LABELS[category as NewsCategory]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`news-body-${state.newsId}`}>本文</Label>
        <textarea
          id={`news-body-${state.newsId}`}
          name="body"
          defaultValue={state.body ?? ""}
          required
          maxLength={3000}
          rows={8}
          className="flex min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm"
          aria-invalid={state.error ? true : undefined}
        />
        <p className="text-sm text-muted-foreground">
          1文字以上3000文字以内で入力してください。改行はそのまま表示されます。
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`news-start-at-${state.newsId}`}>公開開始日時</Label>
          <Input
            id={`news-start-at-${state.newsId}`}
            name="startAt"
            type="datetime-local"
            defaultValue={state.startAt ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`news-end-at-${state.newsId}`}>公開終了日時</Label>
          <Input
            id={`news-end-at-${state.newsId}`}
            name="endAt"
            type="datetime-local"
            defaultValue={state.endAt ?? ""}
          />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          name="published"
          type="checkbox"
          defaultChecked={state.published ?? true}
          className="size-4"
        />
        公開する
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="confirm" disabled={pending}>
          {pending ? "確認中..." : "確認する"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
          キャンセル
        </Button>
      </div>
    </form>
  );
}

// 一覧の「編集」ボタンと更新ポップアップ。開くたびに一覧から渡された現在値でフォームを作り直す。
export function NewsEditDialog({ news }: { news: NewsSummary }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = () => {
    setOpen(false);
    setFormKey((key) => key + 1);
  };
  const initialState = toInitialState(news);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          編集
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>お知らせを編集</DialogTitle>
        </DialogHeader>
        <NewsEditDialogForm key={formKey} initialState={initialState} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
