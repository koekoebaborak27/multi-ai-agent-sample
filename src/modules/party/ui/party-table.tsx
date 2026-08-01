import { deletePartyAction } from "@/modules/party/actions";
import type { PartySummary } from "@/modules/party/types";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function PartyTable({ parties }: { parties: PartySummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>名称</TableHead>
          <TableHead>分類</TableHead>
          <TableHead>連絡先</TableHead>
          <TableHead className="text-right">操作</TableHead>
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
