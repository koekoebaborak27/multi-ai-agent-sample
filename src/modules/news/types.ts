// お知らせのカテゴリの固定値。
// アルファベット順が表示優先順（障害情報→メンテナンス→お知らせ）と一致するように選定しているため、
// この並びを変えると§01.1.4の並び順（`ORDER BY category ASC`だけで優先順位を実現する仕組み）が崩れる。
export const NEWS_CATEGORIES = ["INCIDENT", "MAINTENANCE", "NEWS"] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  INCIDENT: "障害情報",
  MAINTENANCE: "メンテナンス",
  NEWS: "お知らせ",
};

// お知らせ管理一覧（NEWS-02）で並び替えできる項目（§20.1.3）
export const NEWS_SORT_FIELDS = ["title", "category", "startAt", "endAt"] as const;
export type NewsSortField = (typeof NEWS_SORT_FIELDS)[number];

// 公開ステータス（§20.3）。DBには保存せず、一覧取得のたびに判定する
export const NEWS_PUBLISH_STATUSES = ["PUBLISHED", "SCHEDULED", "ENDED", "UNPUBLISHED"] as const;
export type NewsPublishStatus = (typeof NEWS_PUBLISH_STATUSES)[number];

export const NEWS_PUBLISH_STATUS_LABELS: Record<NewsPublishStatus, string> = {
  PUBLISHED: "公開中",
  SCHEDULED: "公開前",
  ENDED: "終了",
  UNPUBLISHED: "非公開中",
};

/**
 * お知らせ管理一覧に表示する1行分の情報。
 * 一覧には出さない`body`も持たせている。編集ポップアップ（§22.1.1）が一覧の行データを
 * そのまま初期値として使い、開くたびにサーバーへ問い合わせない設計のため。
 */
export interface NewsSummary {
  id: string;
  title: string;
  body: string;
  category: NewsCategory;
  categoryLabel: string;
  published: boolean;
  startAt: Date | null;
  endAt: Date | null;
  publishStatus: NewsPublishStatus;
  publishStatusLabel: string;
  createdByName: string;
  updatedByName: string;
  updatedAt: Date;
}

/** トップ画面（NEWS-01）に表示する1件分の情報 */
export interface NewsFeedItem {
  id: string;
  title: string;
  body: string;
  category: NewsCategory;
  // COALESCE(startAt, createdAt) の実効値。表示（§10.1.3）と並び替え（§01.1.5）の両方に使う
  displayAt: Date;
}

/** トップ画面の初回取得・「さらに表示」（§10.2）で共通に使う取得結果 */
export interface NewsFeedPage {
  items: NewsFeedItem[];
  hasMore: boolean;
}

/** お知らせ管理一覧の検索で使う絞り込み条件（§20.2） */
export interface NewsSearchCriteria {
  category?: NewsCategory;
  keyword?: string;
}
