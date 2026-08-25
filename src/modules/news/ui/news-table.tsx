import type { NewsSortField, NewsSummary } from "@/modules/news/types";
import type { SortOrder } from "@/shared/api/pagination";
import { NewsEditDialog } from "@/modules/news/ui/news-edit-dialog";
import { NewsDeleteDialog } from "@/modules/news/ui/news-delete-dialog";
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

// 一覧の日時を日本時間の年月日・時刻で表示する。
// 表示する端末の設定が異なっても、管理画面内で同じ日時を確認できるようにしている。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

interface NewsTableProps {
  news: NewsSummary[];
  baseUrl: string;
  sort: NewsSortField;
  order: SortOrder;
}

// お知らせ管理一覧を表示するテーブル。
// 見出しの並び替えはURLを移動してサーバー側で再検索し、現在の検索条件はそのまま保つ。
export function NewsTable({ news, baseUrl, sort, order }: NewsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="title"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            タイトル
          </SortableTableHead>
          <SortableTableHead
            sortKey="category"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            カテゴリ
          </SortableTableHead>
          <SortableTableHead
            sortKey="startAt"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            公開開始日時
          </SortableTableHead>
          <SortableTableHead
            sortKey="endAt"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            公開終了日時
          </SortableTableHead>
          {/* 公開ステータスは表示時点で計算する値のため、並び替えの対象にしない。 */}
          <TableHead>公開ステータス</TableHead>
          {/* 登録者・更新者はIDから表示名へ変換した値のため、並び替えの対象にしない。 */}
          <TableHead>登録者</TableHead>
          <TableHead>更新者</TableHead>
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {news.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground">
              該当するお知らせがありません
            </TableCell>
          </TableRow>
        ) : (
          news.map((item) => (
            <TableRow key={item.id}>
              <TableCell>{item.title}</TableCell>
              <TableCell>{item.categoryLabel}</TableCell>
              <TableCell className="tabular-nums">
                {item.startAt ? dateTimeFormatter.format(item.startAt) : "—"}
              </TableCell>
              <TableCell className="tabular-nums">
                {item.endAt ? dateTimeFormatter.format(item.endAt) : "—"}
              </TableCell>
              <TableCell>{item.publishStatusLabel}</TableCell>
              <TableCell>{item.createdByName}</TableCell>
              <TableCell>{item.updatedByName}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <NewsEditDialog news={item} />
                  <NewsDeleteDialog news={item} />
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
