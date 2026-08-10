import { deleteUserAction } from "@/modules/user/actions";
import type { UserSortField, UserSummary } from "@/modules/user/types";
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

interface UserTableProps {
  users: UserSummary[];
  sort: UserSortField;
  order: SortOrder;
  baseUrl: string;
}

export function UserTable({ users, sort, order, baseUrl }: UserTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="userId"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            ユーザーID
          </SortableTableHead>
          <SortableTableHead
            sortKey="displayName"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            表示名
          </SortableTableHead>
          <SortableTableHead
            sortKey="role"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            ロール
          </SortableTableHead>
          <SortableTableHead
            sortKey="authMethod"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            認証
          </SortableTableHead>
          <SortableTableHead
            sortKey="status"
            currentSort={sort}
            currentOrder={order}
            baseUrl={baseUrl}
          >
            状態
          </SortableTableHead>
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground">
              ユーザーがいません
            </TableCell>
          </TableRow>
        ) : (
          users.map((u) => (
            <TableRow key={u.userId}>
              <TableCell className="font-mono">{u.userId}</TableCell>
              <TableCell>{u.displayName ?? "-"}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell>{u.authMethod}</TableCell>
              <TableCell>
                {u.locked ? (
                  <span className="text-destructive">ロック中</span>
                ) : u.mustChangePassword ? (
                  <span className="text-muted-foreground">要PW変更</span>
                ) : (
                  "有効"
                )}
              </TableCell>
              <TableCell className="text-right">
                <form action={deleteUserAction} className="inline">
                  <input type="hidden" name="userId" value={u.userId} />
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
