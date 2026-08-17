import type { MasterExcelExportSummary } from "@/modules/master/types";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

// 実行日時の表示形式。秒まで表示し、10秒間隔の自動更新で状態が変わったことが分かりやすいようにする。
const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

interface MasterExcelExportTableProps {
  items: MasterExcelExportSummary[];
}

// マスタ情報Excel取得（MST-11）の実行履歴一覧テーブル。
// 並び替えは行わない（依頼日時の降順で固定のため）ので、素のTableプリミティブを使う。
export function MasterExcelExportTable({ items }: MasterExcelExportTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>実行日時</TableHead>
          <TableHead>状態</TableHead>
          <TableHead>実行者</TableHead>
          <TableHead>件数</TableHead>
          <TableHead>ファイル</TableHead>
          <TableHead>エラー内容</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              まだ実行履歴がありません
            </TableCell>
          </TableRow>
        ) : (
          items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="tabular-nums">
                {dateTimeFormatter.format(item.createdAt)}
              </TableCell>
              <TableCell>
                <span className={item.status === "FAILED" ? "text-destructive" : undefined}>
                  {item.statusLabel}
                </span>
              </TableCell>
              <TableCell>{item.requestedByName}</TableCell>
              <TableCell>
                {item.categoryRowCount !== null && item.masterRowCount !== null ? (
                  <>
                    分類 {item.categoryRowCount}件 / マスタ {item.masterRowCount}件
                  </>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell>
                {item.downloadHref ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={item.downloadHref}>ダウンロード</a>
                  </Button>
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-destructive">{item.errorMessage ?? "—"}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
