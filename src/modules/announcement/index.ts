import { announcementRepository } from "@/modules/announcement/repository";

// このモジュールを外部へ公開する窓口。
// お知らせは表示するだけで登録・更新の機能が無いため、取得処理だけを公開している。
export const announcementService = {
  /** 公開中のお知らせを新しい順に取得する */
  listLatest: (limit?: number) => announcementRepository.listPublished(limit),
};
