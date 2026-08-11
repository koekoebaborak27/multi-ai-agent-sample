import { prisma } from "@/shared/db/prisma";
import type { Announcement } from "@prisma/client";

export const announcementRepository = {
  // トップ画面に出すお知らせを、新しいものから順に取得する。
  // 公開されていないものと削除済みのものは除く。
  listPublished(limit = 5): Promise<Announcement[]> {
    return prisma.announcement.findMany({
      where: { published: true, deleted: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
