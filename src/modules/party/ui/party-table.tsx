import { deletePartyAction } from "@/modules/party/actions";
import type { PartySortField, PartySummary } from "@/modules/party/types";
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

interface PartyTableProps {
  parties: PartySummary[];
  sort: PartySortField;
  order: SortOrder;
  baseUrl: string;
}

export function PartyTable({ parties, sort, order, baseUrl }: PartyTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="name"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            名称
          </SortableTableHead>
          <SortableTableHead
            sortKey="kind"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            分類
          </SortableTableHead>
          <SortableTableHead
            sortKey="contactInfo"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            連絡先
          </SortableTableHead>
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {parties.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              契約先がいません
            </TableCell>
          </TableRow>
        ) : (
          parties.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              <TableCell>{p.kind ?? "-"}</TableCell>
              <TableCell>{p.contactInfo ?? "-"}</TableCell>
              <TableCell className="text-right">
                <form action={deletePartyAction} className="inline">
                  <input type="hidden" name="id" value={p.id} />
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
