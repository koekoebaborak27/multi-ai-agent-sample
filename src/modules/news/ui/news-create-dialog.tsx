"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createNewsAction, type NewsCreateFormState } from "@/modules/news/actions";
import { NEWS_CATEGORIES, NEWS_CATEGORY_LABELS, type NewsCategory } from "@/modules/news/types";
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

const initialState: NewsCreateFormState = { mode: "create", phase: "input", published: true };

interface NewsCreateDialogFormProps {
  onClose: () => void;
}

// お知らせの入力・確認・登録をポップアップ内で切り替える本体。
function NewsCreateDialogForm({ onClose }: NewsCreateDialogFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createNewsAction, initialState);
  // 確認画面から戻るために、確認した状態そのものを記憶する。
  const [editingState, setEditingState] = useState<NewsCreateFormState | null>(null);

  useEffect(() => {
    if (!state.success) return;
    toast.success("お知らせを登録しました");
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
      <div className="space-y-2">
        <Label htmlFor="news-title">タイトル</Label>
        <Input
          id="news-title"
          name="title"
          defaultValue={state.title ?? ""}
          required
          maxLength={200}
          aria-invalid={state.error ? true : undefined}
        />
        <p className="text-sm text-muted-foreground">1文字以上200文字以内で入力してください。</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="news-category">カテゴリ</Label>
        <select
          id="news-category"
          name="category"
          defaultValue={state.category ?? ""}
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          aria-invalid={state.error ? true : undefined}
        >
          <option value="" disabled>
            カテゴリを選択してください
          </option>
          {NEWS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {NEWS_CATEGORY_LABELS[category as NewsCategory]}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="news-body">本文</Label>
        <textarea
          id="news-body"
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
          <Label htmlFor="news-start-at">公開開始日時</Label>
          <Input
            id="news-start-at"
            name="startAt"
            type="datetime-local"
            defaultValue={state.startAt ?? ""}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="news-end-at">公開終了日時</Label>
          <Input
            id="news-end-at"
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

// 一覧画面の「新規登録」ボタンと登録ポップアップ。
// 閉じるたびにフォームを作り直し、前回の入力値や成功状態を次回に持ち越さない。
export function NewsCreateDialog() {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const close = () => {
    setOpen(false);
    setFormKey((key) => key + 1);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => setOpen(next)}>
      <DialogTrigger asChild>
        <Button>新規登録</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>お知らせを登録</DialogTitle>
        </DialogHeader>
        <NewsCreateDialogForm key={formKey} onClose={close} />
      </DialogContent>
    </Dialog>
  );
}
