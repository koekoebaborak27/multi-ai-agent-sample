import Link from "next/link";
import type { MasterCategorySortField, MasterCategorySummary } from "@/modules/master/types";
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

interface MasterCategoryTableProps {
  categories: MasterCategorySummary[];
  sort: MasterCategorySortField;
  order: SortOrder;
  baseUrl: string;
}

// マスタ分類の一覧テーブル。
// マスタ一覧のテーブルと同じく、見出しをクリックすると並び順を変えたURLへ移動して表示し直す。
export function MasterCategoryTable({
  categories,
  sort,
  order,
  baseUrl,
}: MasterCategoryTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="code"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            マスタ分類コード
          </SortableTableHead>
          <SortableTableHead
            sortKey="name"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            マスタ分類名
          </SortableTableHead>
          <SortableTableHead
            sortKey="masterCount"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
            align="right"
          >
            登録マスタ件数
          </SortableTableHead>
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              登録されているマスタ分類がありません
            </TableCell>
          </TableRow>
        ) : (
          categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-mono">{category.code}</TableCell>
              <TableCell>{category.name}</TableCell>
              <TableCell className="text-right tabular-nums">{category.masterCount}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="outline" size="sm">
                  <Link href={`/master/categories/${category.id}`}>詳細</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
