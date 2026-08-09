import "server-only";
import { prisma } from "@/shared/db/prisma";
import type { MasterCategory, Prisma } from "@prisma/client";

export type MasterCategoryListRecord = Prisma.MasterCategoryGetPayload<{
  select: {
    id: true;
    name: true;
    _count: { select: { masters: true } };
  };
}>;

export type MasterCategoryDetailRecord = Prisma.MasterCategoryGetPayload<{
  select: {
    id: true;
    name: true;
    createdAt: true;
    createdBy: true;
    updatedAt: true;
    updatedBy: true;
    _count: { select: { masters: true } };
  };
}>;

export const masterRepository = {
  async listCategoriesAndCount(
    skip: number,
    take: number,
  ): Promise<[MasterCategoryListRecord[], number]> {
    return Promise.all([
      prisma.masterCategory.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { masters: true } },
        },
        orderBy: { id: "asc" },
        skip,
        take,
      }),
      prisma.masterCategory.count(),
    ]);
  },

  findCategoryByName(name: string): Promise<Pick<MasterCategory, "id"> | null> {
    return prisma.masterCategory.findUnique({ where: { name }, select: { id: true } });
  },

  findCategoryByIdWithCount(id: number): Promise<MasterCategoryDetailRecord | null> {
    return prisma.masterCategory.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        _count: { select: { masters: true } },
      },
    });
  },

  createCategory(data: Prisma.MasterCategoryCreateInput): Promise<MasterCategory> {
    return prisma.masterCategory.create({ data });
  },

  async updateCategoryIfUnchanged(
    id: number,
    expectedUpdatedAt: Date,
    name: string,
    updatedBy: string,
  ): Promise<boolean> {
    const result = await prisma.masterCategory.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data: { name, updatedBy },
    });
    return result.count === 1;
  },
};
