import type { NewsFeedItem as NewsFeedItemData } from "@/modules/news/types";

// トップ画面で使う日時の表示形式。
// 表示する端末の設定に左右されず、設計書で定めた日本時間・時刻まで含む形にそろえる。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

// 日時を設計書の「2026-08-24 09:00」の形にする。
// Intl.DateTimeFormatの区切り文字は実行環境で変わるため、必要な部分だけを取り出して組み立てる。
function formatDateTime(date: Date): string {
  const parts = Object.fromEntries(
    dateTimeFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

interface NewsItemProps {
  item: NewsFeedItemData;
}

// お知らせを1件表示する。
// カテゴリごとの重要度を文字色で示し、本文はReactのテキスト描画で安全に表示する。
export function NewsItem({ item }: NewsItemProps) {
  const categoryClassName =
    item.category === "INCIDENT"
      ? "text-destructive"
      : item.category === "MAINTENANCE"
        ? "text-blue-600 dark:text-blue-400"
        : undefined;

  return (
    <li className={`border-b pb-2 last:border-0 ${categoryClassName ?? ""}`}>
      <p className="font-bold tabular-nums">
        {formatDateTime(item.displayAt)}：{item.title}
      </p>
      <p className="max-w-3xl text-sm leading-6 whitespace-pre-line">{item.body}</p>
    </li>
  );
}
