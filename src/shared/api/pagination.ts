import { z } from "zod";
import { env } from "@/shared/config/env";

/**
 * ページ指定の入力チェック。ページ番号は1から数える。
 * 1ページの件数は指定が無ければ環境変数の値を使い、多すぎる指定は 200 件までに制限する
 * （一度に大量のデータを取得されて負荷がかかるのを防ぐため）。
 */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(200).default(env.PAGE_SIZE),
  sort: z.string().optional(),
  order: z.enum(["asc", "desc"]).default("asc"),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export type SortOrder = PaginationQuery["order"];

/** 一覧画面が使う、ページ番号と並び順の組 */
export interface ListQuery<TSort extends string> {
  page: number;
  sort: TSort;
  order: SortOrder;
}

/**
 * 一覧画面のURLに含まれるページ番号・並び順を、画面で使える形に整える。
 *
 * URLは利用者が手で書き換えられるため、そのまま信用しない。
 * 並び替えの項目は、呼び出し側が渡した「許可する項目の一覧」に含まれるものだけを通し、
 * それ以外やおかしな値のときは、あらかじめ決めた初期値に置き換えて必ず画面を表示できるようにする。
 */
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

/**
 * ページ番号を、データベースへの指定（何件読み飛ばして何件取得するか）に変換する。
 * 画面はページ番号で考え、データベースは件数で考えるため、その差を埋める。
 */
export function toSkipTake(q: Pick<PaginationQuery, "page" | "pageSize">) {
  return { skip: (q.page - 1) * q.pageSize, take: q.pageSize };
}

/** ページ分けされた一覧の結果。画面のページ送りに必要な情報を一緒に持つ */
export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/**
 * 取得した一覧と全体件数から、画面が使うページ分けの結果を組み立てる。
 * 該当が0件でも「1ページ目を表示している」と扱えるよう、総ページ数は最低でも1にする。
 */
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
