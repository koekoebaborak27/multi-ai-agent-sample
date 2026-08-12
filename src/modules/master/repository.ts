import "server-only";
import type {
  MasterCategorySortField,
  MasterExportTarget,
  MasterSortField,
} from "@/modules/master/types";
import type { SortOrder } from "@/shared/api/pagination";
import { prisma } from "@/shared/db/prisma";
import type { Master, MasterCategory, MasterExport, Prisma } from "@prisma/client";

// ここから 4 つは、データベースから取得する項目の組み合わせを表す型。
// 画面ごとに必要な項目だけを取得しており、その「取得した結果の形」に名前を付けている。
// テーブルの項目を増減させたときに、どの取得処理に影響するかを型で追えるようにする狙い。

/** 分類一覧で取得する項目（分類に属するマスタの件数も一緒に数える） */
export type MasterCategoryListRecord = Prisma.MasterCategoryGetPayload<{
  select: {
    id: true;
    name: true;
    _count: { select: { masters: true } };
  };
}>;

/** 分類詳細で取得する項目（一覧の項目に、いつ誰が登録・更新したかの記録を加えたもの） */
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

/** マスタ一覧で取得する項目（画面に分類名も出すため、分類テーブルから名前も一緒に取得する） */
export type MasterListRecord = Prisma.MasterGetPayload<{
  select: {
    id: true;
    categoryId: true;
    code: true;
    content: true;
    category: { select: { name: true } };
  };
}>;

/** マスタ詳細で取得する項目（一覧の項目に、いつ誰が登録・更新したかの記録を加えたもの） */
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

/** マスタ一覧の絞り込み条件。指定しなかった項目では絞り込まない */
export interface MasterListFilters {
  categoryId?: number;
  keyword?: string;
}

// マスタ一覧の絞り込み条件から、Prismaのwhere句を組み立てる。
// 一覧取得（listMastersAndCount）と件数のみの取得（countMasters）の両方で同じ絞り込みを使うため、
// 条件の組み立てをここへ1か所にまとめている。
function buildMasterWhere(filters: MasterListFilters): Prisma.MasterWhereInput {
  return {
    // 分類が指定されていない（"all"）ときは、絞り込み条件を付けずすべての分類を対象にする
    ...(filters.categoryId === undefined ? {} : { categoryId: filters.categoryId }),
    // キーワードは、マスタコードか内容のどちらかに一部でも一致すればヒットとする。
    // 大文字・小文字を区別しないのは、コードが英大文字で登録されていても、
    // 利用者が小文字で入力して検索できるようにするため。
    ...(filters.keyword
      ? {
          OR: [
            { code: { contains: filters.keyword, mode: "insensitive" } },
            { content: { contains: filters.keyword, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

export const masterRepository = {
  // マスタの一覧を、検索条件・ページ・並び順に従って取得し、あわせて全体の件数も返す。
  // 一覧データと件数を同時に必要とする呼び出し元（service.listMasters）のために、
  // 同じ絞り込み条件で一覧取得と件数取得を同時に実行し、まとめて1回で返している。
  async listMastersAndCount(
    filters: MasterListFilters,
    skip: number,
    take: number,
    sort: MasterSortField,
    order: SortOrder,
  ): Promise<[MasterListRecord[], number]> {
    const where = buildMasterWhere(filters);
    // 選んだ並び順を優先しつつ、並び替えの基準となる値が同じ行どうしの順番が
    // 実行のたびに変わらないよう、マスタコードなども並び順に加えている
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

  // マスタの件数だけを数える。CSVダウンロードの依頼時（§13.8）に、一覧を取得せず上限判定だけ行いたいために使う。
  countMasters(filters: MasterListFilters): Promise<number> {
    return prisma.master.count({ where: buildMasterWhere(filters) });
  },

  // 分類プルダウン用に、すべての分類を id 順（=登録順）で取得する。
  // 件数がページ分けを必要とするほど多くならない想定のため、ページ分けはしない。
  listCategoryOptions(): Promise<Pick<MasterCategory, "id" | "name">[]> {
    return prisma.masterCategory.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    });
  },

  // マスタ分類の一覧を、ページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listCategoriesAndCount(
    skip: number,
    take: number,
    sort: MasterCategorySortField,
    order: SortOrder,
  ): Promise<[MasterCategoryListRecord[], number]> {
    // 分類コードは連番をそのまま使っているため、コード順の並び替えは連番の並び替えで代用できる
    const primaryOrder: Prisma.MasterCategoryOrderByWithRelationInput =
      sort === "code"
        ? { id: order }
        : sort === "name"
          ? { name: order }
          : { masters: { _count: order } };
    // コード順以外は同じ値の行が出るため、順番が毎回変わらないよう連番も並び順に加える
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

  // マスタ分類の件数だけを数える。マスタの countMasters と同じく、CSVダウンロードの上限判定に使う。
  countCategories(): Promise<number> {
    return prisma.masterCategory.count();
  },

  // マスタ1件を取得する。詳細画面の表示と、更新前の内容確認の両方で使う。
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

  // 分類とマスタコードの組み合わせでマスタを探す。コードが重複していないかの確認に使う。
  // 見つかったかどうかが分かればよいので、取得する項目は連番だけに絞っている。
  findMasterByCategoryAndCode(
    categoryId: number,
    code: string,
  ): Promise<Pick<Master, "id"> | null> {
    return prisma.master.findUnique({
      where: { categoryId_code: { categoryId, code } },
      select: { id: true },
    });
  },

  // マスタを1件登録し、登録後の内容を返す。
  // 登録直後に詳細画面へ移動するため、移動先のURLに必要な連番を受け取れるようにしている。
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

  // 分類が存在するかどうかだけを確認する。存在確認が目的なので、取得する項目は連番だけに絞っている。
  findCategoryById(id: number): Promise<Pick<MasterCategory, "id"> | null> {
    return prisma.masterCategory.findUnique({ where: { id }, select: { id: true } });
  },

  // 同じ名前の分類がすでにあるかを確認する。こちらも存在確認が目的なので、取得するのは連番だけ。
  findCategoryByName(name: string): Promise<Pick<MasterCategory, "id"> | null> {
    return prisma.masterCategory.findUnique({ where: { name }, select: { id: true } });
  },

  // 分類1件を、属するマスタの件数も一緒に取得する。詳細画面の表示と、更新前の内容確認で使う。
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

  // マスタ分類を1件登録する。
  createCategory(data: Prisma.MasterCategoryCreateInput): Promise<MasterCategory> {
    return prisma.masterCategory.create({ data });
  },

  // 分類を更新する。ただし「最終更新日時が expectedUpdatedAt のままである」ときだけ更新する。
  // 更新画面を開いてから保存するまでの間に他の利用者が更新していた場合、この条件に合わなくなるので
  // 上書きされない。更新できたかどうかを true / false で返す。
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

  // マスタを更新する。分類の更新と同じく、最終更新日時が変わっていないときだけ更新する。
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

  // マスタを削除する。物理削除であり、更新と同じく最終更新日時が変わっていないときだけ削除する。
  async deleteMasterIfUnchanged(id: number, expectedUpdatedAt: Date): Promise<boolean> {
    const result = await prisma.master.deleteMany({
      where: { id, updatedAt: expectedUpdatedAt },
    });
    return result.count === 1;
  },

  // マスタ分類を削除する。マスタの削除と同じく、最終更新日時が変わっていないときだけ削除する。
  // 配下にマスタが残っている場合は Master.categoryId の外部キー制約により失敗する（呼び出し元で処理する）。
  async deleteCategoryIfUnchanged(id: number, expectedUpdatedAt: Date): Promise<boolean> {
    const result = await prisma.masterCategory.deleteMany({
      where: { id, updatedAt: expectedUpdatedAt },
    });
    return result.count === 1;
  },

  // CSVダウンロードの依頼を、生成待ち（QUEUED）の状態で1件作成する（§13.5.1・§13.6）。
  createExport(data: {
    target: MasterExportTarget;
    categoryId?: number;
    keyword?: string;
    requestedBy: string;
  }): Promise<MasterExport> {
    return prisma.masterExport.create({
      data: {
        target: data.target,
        categoryId: data.categoryId,
        keyword: data.keyword,
        requestedBy: data.requestedBy,
      },
    });
  },

  // 保持期限を過ぎた MasterExport を探す。ストレージ上のファイルを消すために filePath も一緒に取得する（§13.9.2）。
  findExpiredExports(createdBefore: Date): Promise<Pick<MasterExport, "id" | "filePath">[]> {
    return prisma.masterExport.findMany({
      where: { createdAt: { lt: createdBefore } },
      select: { id: true, filePath: true },
    });
  },

  // 指定した MasterExport の行をまとめて削除する（受け取り後の削除・期限切れの掃除の両方で使う）。
  async deleteExports(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await prisma.masterExport.deleteMany({ where: { id: { in: ids } } });
  },
};
