import {
  masterRepository,
  type MasterCategoryDetailRecord,
  type MasterCategoryListRecord,
  type MasterDetailRecord,
  type MasterListRecord,
} from "@/modules/master/repository";
import type {
  MasterCategoryDetail,
  MasterCategoryOption,
  MasterCategorySortField,
  MasterCategorySummary,
  MasterDetail,
  MasterSearchCriteria,
  MasterSortField,
  MasterSummary,
} from "@/modules/master/types";
import type {
  CreateMasterCategoryInput,
  CreateMasterInput,
  UpdateMasterCategoryInput,
  UpdateMasterInput,
} from "@/modules/master/validation";
import { paginated, toSkipTake, type Paginated, type SortOrder } from "@/shared/api/pagination";
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

function toMasterSummary(master: MasterListRecord): MasterSummary {
  return {
    id: master.id,
    categoryId: master.categoryId,
    categoryName: master.category.name,
    code: master.code,
    content: master.content,
  };
}

function toMasterDetail(master: MasterDetailRecord): MasterDetail {
  return {
    id: master.id,
    categoryId: master.categoryId,
    categoryName: master.category.name,
    code: master.code,
    content: master.content,
    createdAt: master.createdAt,
    createdBy: master.createdBy,
    updatedAt: master.updatedAt,
    updatedBy: master.updatedBy,
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

function masterNotFound(id: number): AppError {
  return new AppError("MASTER_NOT_FOUND", 404, "対象のマスタが見つかりません", { id });
}

function masterConcurrentUpdate(id: number): AppError {
  return new AppError(
    "MASTER_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
    { id },
  );
}

function masterCodeConflict(categoryId: number, code: string): AppError {
  return new AppError(
    "MASTER_CODE_CONFLICT",
    409,
    "同じマスタ分類に同じマスタコードが登録されています",
    { categoryId, code },
  );
}

async function assertCategoryNameAvailable(name: string, excludeId?: number): Promise<void> {
  const existing = await masterRepository.findCategoryByName(name);
  if (existing && existing.id !== excludeId) throw masterCategoryConflict(name);
}

async function assertCategoryExists(categoryId: number): Promise<void> {
  const category = await masterRepository.findCategoryById(categoryId);
  if (!category) throw masterCategoryNotFound(categoryId);
}

async function assertMasterCodeAvailable(
  categoryId: number,
  code: string,
  excludeId?: number,
): Promise<void> {
  const existing = await masterRepository.findMasterByCategoryAndCode(categoryId, code);
  if (existing && existing.id !== excludeId) throw masterCodeConflict(categoryId, code);
}

export const masterService = {
  async listMasters(
    criteria: MasterSearchCriteria,
    page: number,
    pageSize: number,
    sort: MasterSortField = "category",
    order: SortOrder = "asc",
  ): Promise<Paginated<MasterSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const keyword = criteria.keyword?.trim() || undefined;
    const [masters, total] = await masterRepository.listMastersAndCount(
      { categoryId: criteria.categoryId, keyword },
      skip,
      take,
      sort,
      order,
    );
    return paginated(masters.map(toMasterSummary), total, { page, pageSize });
  },

  async findMasterDetail(id: number): Promise<MasterDetail | null> {
    const master = await masterRepository.findMasterById(id);
    return master ? toMasterDetail(master) : null;
  },

  async listCategoryOptions(): Promise<MasterCategoryOption[]> {
    const categories = await masterRepository.listCategoryOptions();
    return categories.map((category) => ({
      id: category.id,
      code: formatMasterCategoryCode(category.id),
      name: category.name,
    }));
  },

  async listCategories(
    page: number,
    pageSize: number,
    sort: MasterCategorySortField = "code",
    order: SortOrder = "asc",
  ): Promise<Paginated<MasterCategorySummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [categories, total] = await masterRepository.listCategoriesAndCount(
      skip,
      take,
      sort,
      order,
    );
    return paginated(categories.map(toCategorySummary), total, { page, pageSize });
  },

  async findCategoryDetail(id: number): Promise<MasterCategoryDetail | null> {
    const category = await masterRepository.findCategoryByIdWithCount(id);
    return category ? toCategoryDetail(category) : null;
  },

  assertCategoryExists,

  assertMasterCodeAvailable,

  async createMaster(input: CreateMasterInput, userId: string): Promise<MasterSummary> {
    await assertCategoryExists(input.categoryId);
    await assertMasterCodeAvailable(input.categoryId, input.code);

    try {
      const master = await masterRepository.createMaster({
        categoryId: input.categoryId,
        code: input.code,
        content: input.content,
        createdBy: userId,
        updatedBy: userId,
      });
      return toMasterSummary(master);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw masterCodeConflict(input.categoryId, input.code);
        if (error.code === "P2003") throw masterCategoryNotFound(input.categoryId);
      }
      throw error;
    }
  },

  async updateMaster(input: UpdateMasterInput, userId: string): Promise<void> {
    const existing = await masterRepository.findMasterById(input.masterId);
    if (!existing) throw masterNotFound(input.masterId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw masterConcurrentUpdate(input.masterId);
    }

    await assertCategoryExists(input.categoryId);
    await assertMasterCodeAvailable(input.categoryId, input.code, input.masterId);

    try {
      const updated = await masterRepository.updateMasterIfUnchanged(
        input.masterId,
        input.updatedAt,
        {
          categoryId: input.categoryId,
          code: input.code,
          content: input.content,
          updatedBy: userId,
        },
      );
      if (!updated) {
        const current = await masterRepository.findMasterById(input.masterId);
        if (!current) throw masterNotFound(input.masterId);
        throw masterConcurrentUpdate(input.masterId);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === "P2002") throw masterCodeConflict(input.categoryId, input.code);
        if (error.code === "P2003") throw masterCategoryNotFound(input.categoryId);
      }
      throw error;
    }
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
