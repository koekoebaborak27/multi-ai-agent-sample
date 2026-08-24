import { newsRepository, type NewsFeedRow, type NewsListFilters } from "@/modules/news/repository";
import {
  NEWS_CATEGORY_LABELS,
  NEWS_PUBLISH_STATUS_LABELS,
  type NewsCategory,
  type NewsFeedItem,
  type NewsFeedPage,
  type NewsPublishStatus,
  type NewsSearchCriteria,
  type NewsSortField,
  type NewsSummary,
} from "@/modules/news/types";
import type { CreateNewsInput, DeleteNewsInput, UpdateNewsInput } from "@/modules/news/validation";
import { userService } from "@/modules/user/service";
import { paginated, toSkipTake, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import type { News } from "@prisma/client";

/** トップ画面用の生SQL取得結果を、画面表示用の形へ詰め替える */
function toFeedItem(row: NewsFeedRow): NewsFeedItem {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    category: row.category as NewsCategory,
    displayAt: row.displayAt,
  };
}

// 公開ステータス（§20.3）を判定する。DBには保存せず、一覧取得のたびに計算する。
// publishedを最優先し、OFFの場合は公開期間の状態に関わらず常に「非公開中」とする。
function toPublishStatus(news: Pick<News, "published" | "startAt" | "endAt">, now: Date): NewsPublishStatus {
  if (!news.published) return "UNPUBLISHED";
  if (news.startAt && news.startAt.getTime() > now.getTime()) return "SCHEDULED";
  if (news.endAt && news.endAt.getTime() < now.getTime()) return "ENDED";
  return "PUBLISHED";
}

/** お知らせ管理一覧の1行分のデータを作る。登録者・更新者はIDから表示名へ解決したものを使う */
function toSummary(news: News, displayNameById: Map<string, string>, now: Date): NewsSummary {
  const category = news.category as NewsCategory;
  const status = toPublishStatus(news, now);
  return {
    id: news.id,
    title: news.title,
    body: news.body,
    category,
    categoryLabel: NEWS_CATEGORY_LABELS[category],
    published: news.published,
    startAt: news.startAt,
    endAt: news.endAt,
    publishStatus: status,
    publishStatusLabel: NEWS_PUBLISH_STATUS_LABELS[status],
    createdByName: news.createdBy ? (displayNameById.get(news.createdBy) ?? news.createdBy) : "-",
    updatedByName: news.updatedBy ? (displayNameById.get(news.updatedBy) ?? news.updatedBy) : "-",
    updatedAt: news.updatedAt,
  };
}

/** 指定されたお知らせが見つからないときのエラー（すでに削除された、確認ダイアログを開いた後に削除された、等） */
function newsNotFound(id: string): AppError {
  return new AppError("NEWS_NOT_FOUND", 404, "対象のお知らせが見つかりません", { id });
}

/** 編集・削除ポップアップを開いてから実行するまでの間に、他の利用者が先に更新・削除していたときのエラー */
function newsConcurrentUpdate(id: string): AppError {
  return new AppError(
    "NEWS_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
    { id },
  );
}

export const newsService = {
  // お知らせ管理一覧（NEWS-02）を、検索条件・ページ・並び順に従って取得する（§20）。
  async listNews(
    criteria: NewsSearchCriteria,
    page: number,
    pageSize: number,
    sort: NewsSortField = "startAt",
    order: SortOrder = "desc",
  ): Promise<Paginated<NewsSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const filters: NewsListFilters = {
      category: criteria.category,
      keyword: criteria.keyword?.trim() || undefined,
    };
    const [rows, total] = await newsRepository.listNewsAndCount(filters, skip, take, sort, order);

    // 登録者・更新者の表示名を、1件ずつではなくまとめて解決する（N+1を避ける。マスタと同じ方針）
    const userIds = rows.flatMap((row) => [row.createdBy, row.updatedBy]).filter((id): id is string => !!id);
    const displayNameById = await userService.resolveDisplayNames(userIds);

    const now = new Date();
    return paginated(rows.map((row) => toSummary(row, displayNameById, now)), total, { page, pageSize });
  },

  // トップ画面（NEWS-01）・「さらに表示」（§10.2）で共通に使う、公開中のお知らせ取得。
  // 取得件数がlimit未満なら「これ以上は無い」、limit件ちょうどなら「まだあるかもしれない」として扱う
  // （設計書§10.2.2のとおり。厳密な残数計算はしない）。
  async listPublished(offset: number, limit: number = env.PAGE_SIZE): Promise<NewsFeedPage> {
    const rows = await newsRepository.listPublished(limit, offset);
    return { items: rows.map(toFeedItem), hasMore: rows.length >= limit };
  },

  // トップ画面の初回表示用。announcementService.listLatestと同じ形（配列を直接返す）で公開している。
  async listLatest(limit: number = env.PAGE_SIZE): Promise<NewsFeedItem[]> {
    const page = await newsService.listPublished(0, limit);
    return page.items;
  },

  // お知らせを新規登録する（§21.2.3）。createdBy・updatedByに実行した利用者のユーザーIDを設定する。
  // 登録はお知らせ1行の挿入だけで複数テーブルにまたがらず、一意制約も無いため、
  // トランザクションや重複エラーの変換は不要（マスタと異なる点。設計書§21.4）。
  async createNews(input: CreateNewsInput, userId: string): Promise<void> {
    await newsRepository.createNews({
      title: input.title,
      category: input.category,
      body: input.body,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      published: input.published,
      createdBy: userId,
      updatedBy: userId,
    });
  },

  // お知らせを更新する（§22.1.4）。
  // 検証の順序は「存在 → 同時更新 → 入力検証」（設計書の順序どおり。入力検証はvalidation.ts側で完了済み）。
  async updateNews(input: UpdateNewsInput, userId: string): Promise<void> {
    const existing = await newsRepository.findById(input.newsId);
    if (!existing) throw newsNotFound(input.newsId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw newsConcurrentUpdate(input.newsId);
    }

    const updated = await newsRepository.updateNewsIfUnchanged(input.newsId, input.updatedAt, {
      title: input.title,
      category: input.category,
      body: input.body,
      startAt: input.startAt ?? null,
      endAt: input.endAt ?? null,
      published: input.published,
      updatedBy: userId,
    });
    if (!updated) {
      // 1件も更新されなかった場合、対象が削除されたのか、他の利用者に先に更新されたのかが分からない。
      // どちらなのかを判断して適切なメッセージを出すため、もう一度取得して確かめる（マスタと同じ方針）。
      const current = await newsRepository.findById(input.newsId);
      if (!current) throw newsNotFound(input.newsId);
      throw newsConcurrentUpdate(input.newsId);
    }
  },

  // お知らせを削除する（§23.1.3）。物理削除であり、元に戻せない。
  // 呼び出し元がログへ残せるよう、削除した対象のタイトル・カテゴリを返す（設計書§00.6.1）。
  async deleteNews(input: DeleteNewsInput): Promise<{ title: string; category: NewsCategory }> {
    const existing = await newsRepository.findById(input.newsId);
    if (!existing) throw newsNotFound(input.newsId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw newsConcurrentUpdate(input.newsId);
    }

    const deleted = await newsRepository.deleteNewsIfUnchanged(input.newsId, input.updatedAt);
    if (!deleted) {
      // 物理削除では「存在しない」と「既に削除された」を区別できないため、両者を同一のエラーとして扱う。
      const current = await newsRepository.findById(input.newsId);
      if (!current) throw newsNotFound(input.newsId);
      throw newsConcurrentUpdate(input.newsId);
    }

    return { title: existing.title, category: existing.category as NewsCategory };
  },
};
