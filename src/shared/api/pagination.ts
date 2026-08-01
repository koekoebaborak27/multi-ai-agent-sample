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
