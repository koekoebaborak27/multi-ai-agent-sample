import { prisma } from "@/shared/db/prisma";
import type { Party, Prisma } from "@prisma/client";

export const partyRepository = {
  async listAndCount(skip: number, take: number): Promise<[Party[], number]> {
    return Promise.all([
      prisma.party.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
      prisma.party.count(),
    ]);
  },

  findById(id: string): Promise<Party | null> {
    return prisma.party.findUnique({ where: { id } });
  },

  create(data: Prisma.PartyCreateInput): Promise<Party> {
    return prisma.party.create({ data });
  },

  update(id: string, data: Prisma.PartyUpdateInput): Promise<Party> {
    return prisma.party.update({ where: { id }, data });
  },

  async remove(id: string): Promise<void> {
    await prisma.party.delete({ where: { id } });
  },
};
