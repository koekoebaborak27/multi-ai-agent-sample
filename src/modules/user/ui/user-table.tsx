import { deleteUserAction } from "@/modules/user/actions";
import type { UserSummary } from "@/modules/user/types";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

export function UserTable({ users }: { users: UserSummary[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ユーザーID</TableHead>
          <TableHead>表示名</TableHead>
          <TableHead>ロール</TableHead>
          <TableHead>認証</TableHead>
          <TableHead>状態</TableHead>
          <TableHead className="text-right">操作</TableHead>
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
