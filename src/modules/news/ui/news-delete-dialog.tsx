"use client";

import { TriangleAlert } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteNewsAction, type DeleteNewsFormState } from "@/modules/news/actions";
import type { NewsSummary } from "@/modules/news/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { toast } from "@/shared/ui/toaster";

interface NewsDeleteDialogProps {
  news: NewsSummary;
}

// 一覧の1行を削除確認ダイアログの初期状態へ変換する。開くときにサーバーへ問い合わせないため、一覧が持つ値だけを使う。
function toInitialState(news: NewsSummary): DeleteNewsFormState {
  return {
    newsId: news.id,
    title: news.title,
    categoryLabel: news.categoryLabel,
    updatedAt: news.updatedAt.toISOString(),
  };
}

// 一覧の「削除」ボタンと削除確認ダイアログ。処理中は閉じる操作と二重送信を受け付けない。
export function NewsDeleteDialog({ news }: NewsDeleteDialogProps) {
  const router = useRouter();
  const initialState = toInitialState(news);
  const [state, formAction, pending] = useActionState(deleteNewsAction, initialState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!state.success) return;
    toast.success("お知らせを削除しました");
    // URLの検索条件・ページ・並び順を保ったまま、一覧を再読み込みする。
    router.refresh();
  }, [router, state.success]);

  return (
    <AlertDialog
      // 成功後はstateから開いていない状態を導くため、Effect内で状態を変更せずに閉じられる。
      open={open && !state.success}
      onOpenChange={(next) => {
        // 削除処理が始まった後は、キャンセルやEscapeキーで閉じないようにする。
        if (pending) return;
        setOpen(next);
      }}
    >
      <Button variant="destructive" size="sm" onClick={() => setOpen(true)}>
        削除
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <TriangleAlert className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle>お知らせを削除しますか？</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left">
              <dl className="grid gap-1 text-sm">
                <dt className="text-muted-foreground">タイトル</dt>
                <dd className="break-words text-foreground">{state.title}</dd>
                <dt className="text-muted-foreground">カテゴリ</dt>
                <dd className="text-foreground">{state.categoryLabel}</dd>
              </dl>
              <p className="text-sm text-destructive">削除したお知らせは元に戻せません。</p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="newsId" value={state.newsId} />
          {/* 物理削除後にも何を削除したかを成功ログで追えるよう、表示したタイトルを一緒に送る。 */}
          <input type="hidden" name="title" value={state.title} />
          <input type="hidden" name="updatedAt" value={state.updatedAt} />
          {state.error ? (
            <p role="alert" className="mb-4 text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>キャンセル</AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={pending}>
              {pending ? "削除中..." : "削除する"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
