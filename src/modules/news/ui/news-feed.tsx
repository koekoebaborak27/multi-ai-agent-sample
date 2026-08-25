"use client";

import type { NewsFeedItem } from "@/modules/news/types";
import { NewsItem } from "@/modules/news/ui/news-item";

interface NewsFeedProps {
  initialItems: NewsFeedItem[];
}

// トップ画面のお知らせ一覧を表示する。
// 工程5でこのコンポーネントに「さらに表示」の状態と追加取得処理を加える。
export function NewsFeed({ initialItems }: NewsFeedProps) {
  if (initialItems.length === 0) {
    return <p className="text-sm text-muted-foreground">現在お知らせはありません</p>;
  }

  return (
    <ul className="space-y-3">
      {initialItems.map((item) => (
        <NewsItem key={item.id} item={item} />
      ))}
    </ul>
  );
}
