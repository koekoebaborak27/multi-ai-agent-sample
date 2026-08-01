import { prisma } from "@/shared/db/prisma";
import type { Announcement } from "@prisma/client";

export const announcementRepository = {
  listPublished(limit = 5): Promise<Announcement[]> {
    return prisma.announcement.findMany({
      where: { published: true, deleted: false },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
