import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { SortOrder } from "@/shared/api/pagination";
import { cn } from "@/shared/ui/utils";

/**
 * 素のスタイル済み <table> プリミティブ（§3）。
 * ソート/ページングはサーバ駆動で各機能側が制御する（TanStack Table は不採用）。
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="table-list-scroll-container relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm whitespace-nowrap", className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        "h-12 border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className,
      )}
      {...props}
    />
  ),
);
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "sticky top-0 z-10 h-12 bg-card px-2 text-left align-middle font-medium text-muted-foreground",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

interface SortableTableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSort: string;
  currentOrder: SortOrder;
  baseUrl: string;
  align?: "left" | "right";
}

/**
 * 見出しをクリックしたときの移動先URLを組み立てる。
 * 今の検索条件はそのまま保ち、並び替えの指定だけを差し替える。
 */
function buildSortUrl(
  baseUrl: string,
  sortKey: string,
  currentSort: string,
  currentOrder: SortOrder,
): string {
  const [pathname, queryString = ""] = baseUrl.split("?");
  const query = new URLSearchParams(queryString);
  query.set("sort", sortKey);
  // すでにその項目の昇順で並んでいる場合だけ降順にし、それ以外は昇順にする
  query.set("order", currentSort === sortKey && currentOrder === "asc" ? "desc" : "asc");
  // 並び替えると表示される内容が変わるため、ページ番号は消して1ページ目から見せる
  query.delete("page");
  const nextQuery = query.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

/**
 * 並び替えができる一覧の見出し。
 * 今どの順で並んでいるかを矢印で示し、クリックすると昇順と降順が切り替わる。
 *
 * 画面内で並び替えるのではなく、並び順を変えたURLへのリンクにしている。
 * こうすると、並び替えた状態のURLをそのまま共有したり、お気に入りに登録したりできる。
 */
function SortableTableHead({
  sortKey,
  currentSort,
  currentOrder,
  baseUrl,
  align = "left",
  className,
  children,
  ...props
}: SortableTableHeadProps) {
  const active = currentSort === sortKey;
  // 押したときにどうなるかを読み上げで伝えるための文言
  const nextOrder = active && currentOrder === "asc" ? "降順" : "昇順";

  return (
    <TableHead
      // 読み上げ機能に、この列が今どの順で並んでいるかを伝える
      aria-sort={active ? (currentOrder === "asc" ? "ascending" : "descending") : "none"}
      className={cn(align === "right" && "text-right", className)}
      {...props}
    >
      <Link
        href={buildSortUrl(baseUrl, sortKey, currentSort, currentOrder)}
        aria-label={`${String(children)}を${nextOrder}で並べ替える`}
        className={cn(
          "flex h-full w-full items-center gap-1 rounded-sm hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          align === "right" && "justify-end",
        )}
      >
        {children}
        {/* 並び替えの対象になっている列は向きが分かる矢印、それ以外は上下両向きの印を出す */}
        {active ? (
          currentOrder === "asc" ? (
            <ArrowUp className="size-4 shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown className="size-4 shrink-0" aria-hidden="true" />
          )
        ) : (
          <ChevronsUpDown className="size-4 shrink-0" aria-hidden="true" />
        )}
      </Link>
    </TableHead>
  );
}

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("p-2 align-middle", className)} {...props} />
));
TableCell.displayName = "TableCell";

export { Table, TableHeader, TableBody, TableRow, TableHead, SortableTableHead, TableCell };
