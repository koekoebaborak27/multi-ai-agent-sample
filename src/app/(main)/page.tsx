import { Megaphone } from "lucide-react";
import { newsService } from "@/modules/news";
import { NewsFeed } from "@/modules/news/ui/news-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// ログインの確認とデータベースからの取得が必要なため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// ログイン後に最初に表示される画面。公開中のお知らせを最初の20件だけ取得して渡す。
// カテゴリ別の表示と、追加取得の状態管理はNewsFeedに任せる。
export default async function DashboardPage() {
  const newsPage = await newsService.listPublished(0);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-tight">トップ</h1>

      <Card className="relative overflow-hidden">
        {/* 右上に置く同心円の飾り。操作の対象ではないため、読み上げの対象からも外している */}
        <svg
          className="pointer-events-none absolute -top-10 -right-6 size-48 text-accent"
          viewBox="0 0 200 200"
          aria-hidden="true"
        >
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
          <circle
            cx="100"
            cy="100"
            r="30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
            opacity="0.5"
          />
        </svg>
        <CardHeader className="relative flex-row items-center gap-3 space-y-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Megaphone className="size-5" aria-hidden="true" />
          </span>
          <CardTitle>お知らせ</CardTitle>
        </CardHeader>
        <CardContent className="relative">
          <NewsFeed initialItems={newsPage.items} initialHasMore={newsPage.hasMore} />
        </CardContent>
      </Card>
    </div>
  );
}
