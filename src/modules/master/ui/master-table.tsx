import Link from "next/link";
import type { MasterSortField, MasterSummary } from "@/modules/master/types";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import {
  SortableTableHead,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

interface MasterTableProps {
  masters: MasterSummary[];
  returnTo: string;
  sort: MasterSortField;
  order: SortOrder;
}

// マスタの検索結果を表示する一覧テーブル。
// 見出しをクリックしたときの並び替えは、画面内の処理では行わず、並び順を変えたURLへのリンクにしている
// （リンク先に移動すると、その並び順であらためて検索し直した結果が表示される）。
export function MasterTable({ masters, returnTo, sort, order }: MasterTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="category"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            マスタ分類
          </SortableTableHead>
          <SortableTableHead
            sortKey="code"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            マスタコード
          </SortableTableHead>
          <SortableTableHead
            sortKey="content"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            マスタ内容
          </SortableTableHead>
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {masters.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              該当するマスタがありません
            </TableCell>
          </TableRow>
        ) : (
          masters.map((master) => (
            <TableRow key={master.id}>
              <TableCell>{master.categoryName}</TableCell>
              <TableCell className="font-mono">{master.code}</TableCell>
              <TableCell>{master.content}</TableCell>
              <TableCell className="text-right">
                {/* 詳細画面から一覧へ戻ってきたときに同じ検索条件・ページを表示できるよう、戻り先のURLを渡す */}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/master/${master.id}?returnTo=${encodeURIComponent(returnTo)}`}>
                    詳細
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
