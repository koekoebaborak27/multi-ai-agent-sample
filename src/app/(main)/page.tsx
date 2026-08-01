import { Megaphone } from "lucide-react";
import { announcementService } from "@/modules/announcement";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

// 認証必須・DB アクセスありのため常に動的レンダリング（ビルド時の事前生成を行わない）
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const announcements = await announcementService.listLatest();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <Card className="relative overflow-hidden">
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
                  <p className="text-sm text-muted-foreground">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">※ マスタは案件ごとに後続実装します。</p>
    </div>
  );
}
