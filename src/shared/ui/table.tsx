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

function buildSortUrl(
  baseUrl: string,
  sortKey: string,
  currentSort: string,
  currentOrder: SortOrder,
): string {
  const [pathname, queryString = ""] = baseUrl.split("?");
  const query = new URLSearchParams(queryString);
  query.set("sort", sortKey);
  query.set("order", currentSort === sortKey && currentOrder === "asc" ? "desc" : "asc");
  query.delete("page");
  const nextQuery = query.toString();
  return nextQuery ? `${pathname}?${nextQuery}` : pathname;
}

/** 現在の並び順を示し、クリックで昇順・降順を切り替える一覧見出し。 */
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
  const nextOrder = active && currentOrder === "asc" ? "降順" : "昇順";

  return (
    <TableHead
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
