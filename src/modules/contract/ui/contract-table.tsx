import { deleteContractAction } from "@/modules/contract/actions";
import type { ContractSummary } from "@/modules/contract/types";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "-";
}

export function ContractTable({ contracts }: { contracts: ContractSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>契約名</TableHead>
          <TableHead>契約先</TableHead>
          <TableHead>開始日</TableHead>
          <TableHead>終了日</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
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
