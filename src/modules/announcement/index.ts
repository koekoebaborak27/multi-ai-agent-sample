import { announcementRepository } from "@/modules/announcement/repository";

export const announcementService = {
  listLatest: (limit?: number) => announcementRepository.listPublished(limit),
};
