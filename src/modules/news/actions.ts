"use server";

import { newsService } from "@/modules/news/service";
import type { NewsFeedPage } from "@/modules/news/types";
import { withOp } from "@/shared/observability/with-op";

// トップ画面で、表示済み件数の次から公開中のお知らせを追加取得する。
// 閲覧はログイン済みの全ロールに許可されており、ログイン確認はproxyで済んでいるため、書き込み権限は確認しない。
export const loadMoreNewsAction = withOp(
  "news.load-more",
  async (offset: number): Promise<NewsFeedPage> => newsService.listPublished(offset),
);
