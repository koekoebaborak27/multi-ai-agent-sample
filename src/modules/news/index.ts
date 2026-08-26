// このモジュールを外部へ公開する窓口。
// 他の機能や画面はここに書かれているものだけを使い、service.ts などモジュール内部のファイルを直接使わない。
export { newsService } from "@/modules/news/service";
export { NewsSearchForm } from "@/modules/news/ui/news-search-form";
export { NewsTable } from "@/modules/news/ui/news-table";
export { NewsCreateDialog } from "@/modules/news/ui/news-create-dialog";
export { NewsEditDialog } from "@/modules/news/ui/news-edit-dialog";
export { NewsDeleteDialog } from "@/modules/news/ui/news-delete-dialog";
export { NewsDeletedToast } from "@/modules/news/ui/news-deleted-toast";
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
