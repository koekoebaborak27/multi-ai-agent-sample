import { prisma } from "@/shared/db/prisma";
import type { Contract, Party, Prisma } from "@prisma/client";

export type ContractWithParty = Contract & { party: Party };

export const contractRepository = {
  async listAndCount(skip: number, take: number): Promise<[ContractWithParty[], number]> {
    return Promise.all([
      prisma.contract.findMany({
        include: { party: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.contract.count(),
    ]);
  },

  findById(id: string): Promise<ContractWithParty | null> {
    return prisma.contract.findUnique({ where: { id }, include: { party: true } });
  },

  create(data: Prisma.ContractCreateInput): Promise<Contract> {
    return prisma.contract.create({ data });
  },

  update(id: string, data: Prisma.ContractUpdateInput): Promise<Contract> {
    return prisma.contract.update({ where: { id }, data });
  },

  async remove(id: string): Promise<void> {
    await prisma.contract.delete({ where: { id } });
  },
};
