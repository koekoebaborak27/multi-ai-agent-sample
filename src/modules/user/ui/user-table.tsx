import { deleteUserAction } from "@/modules/user/actions";
import type { UserSortField, UserSummary } from "@/modules/user/types";
import { UserEditDialog } from "@/modules/user/ui/user-edit-dialog";
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

// 利用者の一覧テーブル（管理者向け画面）。
// 見出しをクリックしたときの並び替えは、並び順を変えたURLへのリンクとして実現している。
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
          {/* 未登録の利用者を見つけられるよう、一覧にもメールアドレスを表示する */}
          <TableHead>メール</TableHead>
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
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              ユーザーがいません
            </TableCell>
          </TableRow>
        ) : (
          users.map((u) => (
            <TableRow key={u.userId}>
              <TableCell className="font-mono">{u.userId}</TableCell>
              <TableCell>{u.displayName ?? "-"}</TableCell>
              <TableCell>{u.email ?? "-"}</TableCell>
              <TableCell>{u.role}</TableCell>
              <TableCell>{u.authMethod}</TableCell>
              {/*
                「状態」はデータベースの項目そのままではなく、
                利用停止中かどうか・初回パスワード変更が必要かを見て表示を切り替えている。
                利用停止のほうが利用者に伝えるべき度合いが高いため、先に判定する。
              */}
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
                <UserEditDialog user={u} />
                {/* 削除する利用者を伝えるため、行ごとに識別子を持たせた小さなフォームにしている */}
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
