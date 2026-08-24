import type { NewsCategory, NewsSortField } from "@/modules/news/types";
import type { SortOrder } from "@/shared/api/pagination";
import { prisma } from "@/shared/db/prisma";
import { Prisma, type News } from "@prisma/client";

/** お知らせ一覧の絞り込み条件。指定しなかった項目では絞り込まない */
export interface NewsListFilters {
  category?: NewsCategory;
  keyword?: string;
}

/** トップ画面（NEWS-01）用に取得する1件分の情報。COALESCE(startAt, createdAt)の実効値も一緒に返す */
export interface NewsFeedRow {
  id: string;
  title: string;
  body: string;
  category: string;
  displayAt: Date;
}

// お知らせ一覧の絞り込み条件から、Prismaのwhere句を組み立てる（title/category/endAtでの並び替え用）。
function buildNewsWhere(filters: NewsListFilters): Prisma.NewsWhereInput {
  return {
    ...(filters.category ? { category: filters.category } : {}),
    // キーワードは、タイトルか本文のどちらかに一部でも一致すればヒットとする（マスタ検索と同じ規約）
    ...(filters.keyword
      ? {
          OR: [
            { title: { contains: filters.keyword, mode: "insensitive" } },
            { body: { contains: filters.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

// 同じ絞り込み条件を生SQL側（startAtでの並び替え用）でも使うため、Prisma.sqlの形で組み立てる。
function buildNewsWhereSql(filters: NewsListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.category) {
    conditions.push(Prisma.sql`"category" = ${filters.category}`);
  }
  if (filters.keyword) {
    const pattern = `%${filters.keyword}%`;
    conditions.push(Prisma.sql`("title" ILIKE ${pattern} OR "body" ILIKE ${pattern})`);
  }
  return conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;
}

// お知らせ一覧の並び順を組み立てる（startAt以外の3列。§20.1.3）。
// 同じ値の行が並ぶ場合でも順番が毎回変わらないよう、連番を並び順に加える。
function buildNewsOrderBy(
  sort: Exclude<NewsSortField, "startAt">,
  order: SortOrder,
): Prisma.NewsOrderByWithRelationInput[] {
  const primary: Prisma.NewsOrderByWithRelationInput =
    sort === "title"
      ? { title: order }
      : sort === "category"
        ? { category: order }
        : { endAt: { sort: order, nulls: "last" } };
  return [primary, { id: "asc" }];
}

// 「公開開始日時」列での並び替え（§01.1.5・§20.1.3）。
// PrismaのorderByではCOALESCE(startAt, createdAt)を表現できないため、この関数だけ生SQLを使う
// （お知らせ機能内で生SQLを使うのはこの並び替えのみ。設計書§00.7）。
async function listNewsAndCountByStartAt(
  filters: NewsListFilters,
  skip: number,
  take: number,
  order: SortOrder,
): Promise<[News[], number]> {
  const whereSql = buildNewsWhereSql(filters);
  const orderSql = order === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  const [rows, countRows] = await Promise.all([
    prisma.$queryRaw<News[]>(Prisma.sql`
      SELECT "id", "title", "body", "category", "published", "startAt", "endAt",
             "createdAt", "createdBy", "updatedAt", "updatedBy"
      FROM "News"
      ${whereSql}
      ORDER BY COALESCE("startAt", "createdAt") ${orderSql}, "id" ASC
      OFFSET ${skip} LIMIT ${take}
    `),
    prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count FROM "News" ${whereSql}
    `),
  ]);

  return [rows, Number(countRows[0]?.count ?? 0)];
}

export const newsRepository = {
  // お知らせ管理一覧（NEWS-02）を、検索条件・ページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listNewsAndCount(
    filters: NewsListFilters,
    skip: number,
    take: number,
    sort: NewsSortField,
    order: SortOrder,
  ): Promise<[News[], number]> {
    if (sort === "startAt") {
      return listNewsAndCountByStartAt(filters, skip, take, order);
    }
    const where = buildNewsWhere(filters);
    const orderBy = buildNewsOrderBy(sort, order);
    return Promise.all([
      prisma.news.findMany({ where, orderBy, skip, take }),
      prisma.news.count({ where }),
    ]);
  },

  // トップ画面（NEWS-01）・「さらに表示」用に、公開中のお知らせを取得する（§01.1.6・§10.1.2）。
  // 並び順（カテゴリ優先度→公開開始日時の実効値の新しい順）を表現するため生SQLを使う。
  listPublished(limit: number, offset: number): Promise<NewsFeedRow[]> {
    return prisma.$queryRaw<NewsFeedRow[]>(Prisma.sql`
      SELECT "id", "title", "body", "category", COALESCE("startAt", "createdAt") AS "displayAt"
      FROM "News"
      WHERE "published" = true
        AND ("startAt" IS NULL OR "startAt" <= now())
        AND ("endAt" IS NULL OR "endAt" >= now())
      ORDER BY "category" ASC, COALESCE("startAt", "createdAt") DESC, "id" ASC
      OFFSET ${offset} LIMIT ${limit}
    `);
  },

  // お知らせ1件を取得する。編集・削除の実行時に、現在の存在確認・updatedAt比較に使う。
  findById(id: string): Promise<News | null> {
    return prisma.news.findUnique({ where: { id } });
  },

  // お知らせを1件登録する。
  createNews(data: Prisma.NewsUncheckedCreateInput): Promise<News> {
    return prisma.news.create({ data });
  },

  // お知らせを更新する。ただし「最終更新日時がexpectedUpdatedAtのままである」ときだけ更新する
  // （マスタと同じ楽観的排他制御。§22.2）。更新できたかどうかをtrue/falseで返す。
  async updateNewsIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: {
      title: string;
      category: NewsCategory;
      body: string;
      startAt: Date | null;
      endAt: Date | null;
      published: boolean;
      updatedBy: string;
    },
  ): Promise<boolean> {
    const result = await prisma.news.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data,
    });
    return result.count === 1;
  },

  // お知らせを削除する。物理削除であり、更新と同じく最終更新日時が変わっていないときだけ削除する（§23.2）。
  async deleteNewsIfUnchanged(id: string, expectedUpdatedAt: Date): Promise<boolean> {
    const result = await prisma.news.deleteMany({
      where: { id, updatedAt: expectedUpdatedAt },
    });
    return result.count === 1;
  },
};
