// このモジュールを外部へ公開する窓口。
// 他の機能や画面はここに書かれているものだけを使い、service.ts などモジュール内部のファイルを直接使わない。
export { newsService } from "@/modules/news/service";
export {
  createNewsSchema,
  deleteNewsSchema,
  newsSearchQuerySchema,
  updateNewsSchema,
  type CreateNewsInput,
  type DeleteNewsInput,
  type NewsSearchQuery,
  type UpdateNewsInput,
} from "@/modules/news/validation";
export {
  NEWS_CATEGORIES,
  NEWS_CATEGORY_LABELS,
  NEWS_PUBLISH_STATUSES,
  NEWS_PUBLISH_STATUS_LABELS,
  NEWS_SORT_FIELDS,
  type NewsCategory,
  type NewsFeedItem,
  type NewsFeedPage,
  type NewsPublishStatus,
  type NewsSearchCriteria,
  type NewsSortField,
  type NewsSummary,
} from "@/modules/news/types";
