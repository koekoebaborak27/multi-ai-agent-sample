import Link from "next/link";
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
  returnTo: string;
  sort: PartySortField;
  order: SortOrder;
}

// 契約先の検索結果を表示する一覧テーブル。
// 見出しをクリックしたときの並び替えは、並び順を変えたURLへのリンクにしている
// （リンク先に移動すると、その並び順であらためて検索し直した結果が表示される）。
// 行の操作は詳細画面への遷移のみで、削除ボタンは置かない（詳細画面だけに配置する方針。§00.4）。
export function PartyTable({ parties, returnTo, sort, order }: PartyTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="name"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            名称
          </SortableTableHead>
          {/* 分類はマスタの内容を解決した表示専用の値のため、データベース上でのソート対象にしない */}
          <TableHead>分類</TableHead>
          <SortableTableHead
            sortKey="contactInfo"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            連絡先
          </SortableTableHead>
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {parties.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              該当する契約先がありません
            </TableCell>
          </TableRow>
        ) : (
          parties.map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.name}</TableCell>
              {/* 分類は未選択・選択先マスタが削除された場合に「未設定」（p.companyTypeLabel）になる */}
              <TableCell>{p.companyTypeLabel}</TableCell>
              {/* 連絡先は任意入力なので、未入力の場合は「-」を表示する */}
              <TableCell>{p.contactInfo ?? "-"}</TableCell>
              <TableCell className="text-right">
                {/* 詳細画面から一覧へ戻ってきたときに同じ検索条件・ページを表示できるよう、戻り先のURLを渡す */}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/parties/${p.id}?returnTo=${encodeURIComponent(returnTo)}`}>
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
