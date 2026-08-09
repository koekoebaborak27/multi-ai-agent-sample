import {
  masterRepository,
  type MasterCategoryDetailRecord,
  type MasterCategoryListRecord,
} from "@/modules/master/repository";
import type { MasterCategoryDetail, MasterCategorySummary } from "@/modules/master/types";
import type {
  CreateMasterCategoryInput,
  UpdateMasterCategoryInput,
} from "@/modules/master/validation";
import { paginated, toSkipTake, type Paginated } from "@/shared/api/pagination";
import { AppError } from "@/shared/errors/app-error";
import { Prisma } from "@prisma/client";

const MASTER_CATEGORY_CODE_LENGTH = 4;

export function formatMasterCategoryCode(id: number): string {
  return String(id).padStart(MASTER_CATEGORY_CODE_LENGTH, "0");
}

function toCategorySummary(category: MasterCategoryListRecord): MasterCategorySummary {
  return {
    id: category.id,
    code: formatMasterCategoryCode(category.id),
    name: category.name,
    masterCount: category._count.masters,
  };
}

function toCategoryDetail(category: MasterCategoryDetailRecord): MasterCategoryDetail {
  return {
    id: category.id,
    code: formatMasterCategoryCode(category.id),
    name: category.name,
    masterCount: category._count.masters,
    createdAt: category.createdAt,
    createdBy: category.createdBy,
    updatedAt: category.updatedAt,
    updatedBy: category.updatedBy,
  };
}

function masterCategoryConflict(name: string): AppError {
  return new AppError("MASTER_CATEGORY_CONFLICT", 409, "同じ名前のマスタ分類が登録されています", {
    name,
  });
}

function masterCategoryNotFound(id: number): AppError {
  return new AppError("MASTER_CATEGORY_NOT_FOUND", 404, "対象のマスタ分類が見つかりません", { id });
}

function masterCategoryConcurrentUpdate(id: number): AppError {
  return new AppError(
    "MASTER_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
    { id },
  );
}

async function assertCategoryNameAvailable(name: string, excludeId?: number): Promise<void> {
  const existing = await masterRepository.findCategoryByName(name);
  if (existing && existing.id !== excludeId) throw masterCategoryConflict(name);
}

export const masterService = {
  async listCategories(page: number, pageSize: number): Promise<Paginated<MasterCategorySummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [categories, total] = await masterRepository.listCategoriesAndCount(skip, take);
    return paginated(categories.map(toCategorySummary), total, { page, pageSize });
  },

  async findCategoryDetail(id: number): Promise<MasterCategoryDetail | null> {
    const category = await masterRepository.findCategoryByIdWithCount(id);
    return category ? toCategoryDetail(category) : null;
  },

  assertCategoryNameAvailable,

  async createCategory(
    input: CreateMasterCategoryInput,
    userId: string,
  ): Promise<MasterCategorySummary> {
    await assertCategoryNameAvailable(input.name);

    try {
      const category = await masterRepository.createCategory({
        name: input.name,
        createdBy: userId,
        updatedBy: userId,
      });
      return {
        id: category.id,
        code: formatMasterCategoryCode(category.id),
        name: category.name,
        masterCount: 0,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw masterCategoryConflict(input.name);
      }
      throw error;
    }
  },

  async updateCategory(input: UpdateMasterCategoryInput, userId: string): Promise<void> {
    const existing = await masterRepository.findCategoryByIdWithCount(input.categoryId);
    if (!existing) throw masterCategoryNotFound(input.categoryId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw masterCategoryConcurrentUpdate(input.categoryId);
    }

    await assertCategoryNameAvailable(input.name, input.categoryId);

    try {
      const updated = await masterRepository.updateCategoryIfUnchanged(
        input.categoryId,
        input.updatedAt,
        input.name,
        userId,
      );
      if (!updated) {
        const current = await masterRepository.findCategoryByIdWithCount(input.categoryId);
        if (!current) throw masterCategoryNotFound(input.categoryId);
        throw masterCategoryConcurrentUpdate(input.categoryId);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw masterCategoryConflict(input.name);
      }
      throw error;
    }
  },
};
