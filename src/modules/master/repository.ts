import "server-only";
import type { MasterCategorySortField, MasterSortField } from "@/modules/master/types";
import type { SortOrder } from "@/shared/api/pagination";
import { prisma } from "@/shared/db/prisma";
import type { Master, MasterCategory, Prisma } from "@prisma/client";

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

export type MasterListRecord = Prisma.MasterGetPayload<{
  select: {
    id: true;
    categoryId: true;
    code: true;
    content: true;
    category: { select: { name: true } };
  };
}>;

export type MasterDetailRecord = Prisma.MasterGetPayload<{
  select: {
    id: true;
    categoryId: true;
    code: true;
    content: true;
    createdAt: true;
    createdBy: true;
    updatedAt: true;
    updatedBy: true;
    category: { select: { name: true } };
  };
}>;

export interface MasterListFilters {
  categoryId?: number;
  keyword?: string;
}

export const masterRepository = {
  async listMastersAndCount(
    filters: MasterListFilters,
    skip: number,
    take: number,
    sort: MasterSortField,
    order: SortOrder,
  ): Promise<[MasterListRecord[], number]> {
    const where: Prisma.MasterWhereInput = {
      ...(filters.categoryId === undefined ? {} : { categoryId: filters.categoryId }),
      ...(filters.keyword
        ? {
            OR: [
              { code: { contains: filters.keyword, mode: "insensitive" } },
              { content: { contains: filters.keyword, mode: "insensitive" } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.MasterOrderByWithRelationInput[] =
      sort === "category"
        ? [{ category: { name: order } }, { code: "asc" }]
        : sort === "code"
          ? [{ code: order }, { category: { name: "asc" } }]
          : [{ content: order }, { category: { name: "asc" } }, { code: "asc" }];

    return Promise.all([
      prisma.master.findMany({
        where,
        select: {
          id: true,
          categoryId: true,
          code: true,
          content: true,
          category: { select: { name: true } },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.master.count({ where }),
    ]);
  },

  listCategoryOptions(): Promise<Pick<MasterCategory, "id" | "name">[]> {
    return prisma.masterCategory.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
  },

  async listCategoriesAndCount(
    skip: number,
    take: number,
    sort: MasterCategorySortField,
    order: SortOrder,
  ): Promise<[MasterCategoryListRecord[], number]> {
    const primaryOrder: Prisma.MasterCategoryOrderByWithRelationInput =
      sort === "code"
        ? { id: order }
        : sort === "name"
          ? { name: order }
          : { masters: { _count: order } };
    const orderBy = sort === "code" ? [primaryOrder] : [primaryOrder, { id: "asc" as const }];
    return Promise.all([
      prisma.masterCategory.findMany({
        select: {
          id: true,
          name: true,
          _count: { select: { masters: true } },
        },
        orderBy,
        skip,
        take,
      }),
      prisma.masterCategory.count(),
    ]);
  },

  findMasterById(id: number): Promise<MasterDetailRecord | null> {
    return prisma.master.findUnique({
      where: { id },
      select: {
        id: true,
        categoryId: true,
        code: true,
        content: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        category: { select: { name: true } },
      },
    });
  },

  findMasterByCategoryAndCode(
    categoryId: number,
    code: string,
  ): Promise<Pick<Master, "id"> | null> {
    return prisma.master.findUnique({
      where: { categoryId_code: { categoryId, code } },
      select: { id: true },
    });
  },

  createMaster(data: Prisma.MasterUncheckedCreateInput): Promise<MasterListRecord> {
    return prisma.master.create({
      data,
      select: {
        id: true,
        categoryId: true,
        code: true,
        content: true,
        category: { select: { name: true } },
      },
    });
  },

  findCategoryById(id: number): Promise<Pick<MasterCategory, "id"> | null> {
    return prisma.masterCategory.findUnique({ where: { id }, select: { id: true } });
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

  async updateMasterIfUnchanged(
    id: number,
    expectedUpdatedAt: Date,
    data: { categoryId: number; code: string; content: string; updatedBy: string },
  ): Promise<boolean> {
    const result = await prisma.master.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data,
    });
    return result.count === 1;
  },
};
