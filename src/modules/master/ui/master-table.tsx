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
