import Link from "next/link";
import {
  CONTRACT_STATUS_LABELS,
  type ContractSortField,
  type ContractSummary,
} from "@/modules/contract/types";
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

/** 日付を「2026-08-12」の形にする。開始日・終了日が未定の場合は「未定」を表示する */
function formatDate(d: Date | null): string {
  return d ? d.toISOString().slice(0, 10) : "未定";
}

interface ContractTableProps {
  contracts: ContractSummary[];
  returnTo: string;
  sort: ContractSortField;
  order: SortOrder;
}

// 契約の検索結果を表示する一覧テーブル。
// 見出しをクリックしたときの並び替えは、並び順を変えたURLへのリンクにしている
// （リンク先に移動すると、その並び順であらためて検索し直した結果が表示される）。
// 行の操作は詳細画面への遷移のみで、削除ボタンは置かない（詳細画面だけに配置する方針）。
export function ContractTable({ contracts, returnTo, sort, order }: ContractTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableTableHead
            sortKey="title"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            契約名
          </SortableTableHead>
          <SortableTableHead
            sortKey="partyName"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            契約先
          </SortableTableHead>
          <SortableTableHead
            sortKey="startDate"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            開始日
          </SortableTableHead>
          <SortableTableHead
            sortKey="endDate"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            終了日
          </SortableTableHead>
          <SortableTableHead
            sortKey="status"
            currentSort={sort}
            currentOrder={order}
            baseUrl={returnTo}
          >
            状態
          </SortableTableHead>
          {/* 契約分類はマスタの内容を解決した表示専用の値のため、データベース上でのソート対象にしない */}
          <TableHead>契約分類</TableHead>
          {/* 「操作」列には見出しの文字を表示しない。目の不自由な方向けの読み上げ用にラベルだけ付けている */}
          <TableHead className="text-right" aria-label="操作" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              該当する契約がありません
            </TableCell>
          </TableRow>
        ) : (
          contracts.map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.title}</TableCell>
              <TableCell>{c.partyName}</TableCell>
              <TableCell>{formatDate(c.startDate)}</TableCell>
              <TableCell>{formatDate(c.endDate)}</TableCell>
              <TableCell>
                {CONTRACT_STATUS_LABELS[c.status as keyof typeof CONTRACT_STATUS_LABELS] ??
                  c.status}
              </TableCell>
              {/* 契約分類は未選択・選択先マスタが削除された場合に「未設定」（c.categoryLabel）になる */}
              <TableCell>{c.categoryLabel}</TableCell>
              <TableCell className="text-right">
                {/* 詳細画面から一覧へ戻ってきたときに同じ検索条件・ページを表示できるよう、戻り先のURLを渡す */}
                <Button asChild variant="outline" size="sm">
                  <Link href={`/contracts/${c.id}?returnTo=${encodeURIComponent(returnTo)}`}>
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
