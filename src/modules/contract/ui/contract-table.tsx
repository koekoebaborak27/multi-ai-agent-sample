import { deleteContractAction } from "@/modules/contract/actions";
import type { ContractSortField, ContractSummary } from "@/modules/contract/types";
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

/** 日付を「2026-08-12」の形にする。開始日・終了日が未定の場合は「-」を表示する */
function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}

interface ContractTableProps {
  contracts: ContractSummary[];
  sort: ContractSortField;
  order: SortOrder;
  baseUrl: string;
}

// 契約の一覧テーブル。
// 見出しをクリックしたときの並び替えは、並び順を変えたURLへのリンクとして実現している。
export function ContractTable({ contracts, sort, order, baseUrl }: ContractTableProps) {
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
            契約名
          </SortableTableHead>
          <SortableTableHead
            sortKey="partyName"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            契約先
          </SortableTableHead>
          <SortableTableHead
            sortKey="startDate"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            開始日
          </SortableTableHead>
          <SortableTableHead
            sortKey="endDate"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            終了日
          </SortableTableHead>
          <SortableTableHead
            sortKey="status"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            状態
          </SortableTableHead>
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              契約がありません
            </TableCell>
          </TableRow>
        ) : (
          contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.title}</TableCell>
              <TableCell>{c.partyName}</TableCell>
              <TableCell>{formatDate(c.startDate)}</TableCell>
              <TableCell>{formatDate(c.endDate)}</TableCell>
              <TableCell>{c.status}</TableCell>
              <TableCell className="text-right">
                {/* 削除する契約を伝えるため、行ごとに識別子を持たせた小さなフォームにしている */}
                <form action={deleteContractAction} className="inline">
                  <input type="hidden" name="id" value={c.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    削除
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
