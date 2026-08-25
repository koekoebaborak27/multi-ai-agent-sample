"use client";

import { useState, useTransition } from "react";
import { loadMoreNewsAction } from "@/modules/news/actions";
import type { NewsFeedItem } from "@/modules/news/types";
import { NewsItem } from "@/modules/news/ui/news-item";
import { MESSAGES } from "@/shared/constants/messages";
import { Button } from "@/shared/ui/button";
import { toast } from "@/shared/ui/toaster";

interface NewsFeedProps {
  initialItems: NewsFeedItem[];
  initialHasMore: boolean;
}

// トップ画面のお知らせ一覧を表示する。
// 「さらに表示」を押したときは、画面を読み直さずに次のページを一覧の末尾へ加える。
export function NewsFeed({ initialItems, initialHasMore }: NewsFeedProps) {
  const [items, setItems] = useState(initialItems);
  const [offset, setOffset] = useState(initialItems.length);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isPending, startTransition] = useTransition();

  // 現在の表示件数を起点に、次のページだけを取得する。
  // 取得中はボタンを無効にするため、同じ位置を二重に取得しない。
  const handleLoadMore = () => {
    startTransition(async () => {
      try {
        const page = await loadMoreNewsAction(offset);
        setItems((currentItems) => [...currentItems, ...page.items]);
        setOffset((currentOffset) => currentOffset + page.items.length);
        setHasMore(page.hasMore);
      } catch {
        toast.error(MESSAGES.common.unexpected);
      }
    });
  };

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">現在お知らせはありません</p>;
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {items.map((item) => (
          <NewsItem key={item.id} item={item} />
        ))}
      </ul>
      {hasMore && (
        <Button type="button" variant="outline" disabled={isPending} onClick={handleLoadMore}>
          {isPending ? "読み込み中..." : "さらに表示"}
        </Button>
      )}
    </div>
  );
}
