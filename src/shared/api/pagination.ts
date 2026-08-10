import { z } from "zod";
import { env } from "@/shared/config/env";

/** ページング要求のクエリスキーマ（1始まりの page と任意の pageSize/sort） */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(env.PAGE_SIZE),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SortOrder = PaginationQuery["order"];

export interface ListQuery<TSort extends string> {
  page: number;
  sort: TSort;
  order: SortOrder;
}

/** 一覧URLのページ・ソート条件を許可リストに基づいて安全な初期値へ補正する。 */
export function parseListQuery<TSort extends string>(
  query: { page?: string; sort?: string; order?: string },
  allowedSorts: readonly TSort[],
  defaultSort: TSort,
  defaultOrder: SortOrder = "asc",
): ListQuery<TSort> {
  const parsedPage = Number(query.page ?? 1);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const sort = allowedSorts.includes(query.sort as TSort) ? (query.sort as TSort) : defaultSort;
  const order = query.order === "asc" || query.order === "desc" ? query.order : defaultOrder;
  return { page, sort, order };
}

/** Prisma の skip/take に変換 */
export function toSkipTake(q: Pick<PaginationQuery, "page" | "pageSize">) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function paginated<T>(
  items: T[],
  total: number,
  q: Pick<PaginationQuery, "page" | "pageSize">,
): Paginated<T> {
  return {
    items,
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  };
}
