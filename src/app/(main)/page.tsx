import { Megaphone } from "lucide-react";
import { newsService } from "@/modules/news";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// ページを毎回サーバー側で作り直す設定。
// ログインの確認とデータベースからの取得が必要なため、あらかじめページを作っておく仕組みは使わない。
export const dynamic = "force-dynamic";

// ログイン後に最初に表示される画面。公開中のお知らせを新しい順に並べる。
// カテゴリ別の文字色分け・「さらに表示」（NewsFeed）は工程4・5で実装するため、
// ここでは一覧の取得元をNewsモジュールへ差し替えるだけにとどめる。
export default async function DashboardPage() {
  const announcements = await newsService.listLatest();

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
          {announcements.length === 0 ? (
            <p className="text-sm text-muted-foreground">お知らせはありません</p>
          ) : (
            <ul className="space-y-3">
              {announcements.map((a) => (
                <li key={a.id} className="border-b pb-2 last:border-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="max-w-3xl text-sm leading-6 whitespace-pre-line text-muted-foreground">
                    {a.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
