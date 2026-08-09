import Link from "next/link";
import type { MasterCategorySummary } from "@/modules/master/types";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function MasterCategoryTable({ categories }: { categories: MasterCategorySummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>マスタ分類コード</TableHead>
          <TableHead>マスタ分類名</TableHead>
          <TableHead className="text-right">登録マスタ件数</TableHead>
          <TableHead className="text-right">操作</TableHead>
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
