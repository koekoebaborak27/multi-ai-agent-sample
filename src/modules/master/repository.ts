import {
  MASTER_EXCEL_EXPORT_CLEANUP_MAX_FILES,
  MASTER_EXPORT_MAX_ROWS,
  type MasterCategorySortField,
  type MasterExcelExportStatus,
  type MasterSortField,
} from "@/modules/master/types";
import type { SortOrder } from "@/shared/api/pagination";
import { prisma } from "@/shared/db/prisma";
import type { Master, MasterCategory, MasterExcelExport, Prisma } from "@prisma/client";

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

// 保持期限切れファイルの掃除（jobs.ts）で使う、削除対象の最小限の項目。
// 取得時のwhere句で「保存先の情報（filePath）が残っている行」だけに絞り込むため実際にはnullは
// 返らないが、Prisma.MasterExcelExportGetPayloadでは列の値がそのままnullを許す型になってしまう。
// その保証をコードの形にも表すため、filePathをstringで固定したこの型を別に用意している。
export type MasterExcelExportFileRecord = Pick<MasterExcelExport, "id"> & { filePath: string };

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

// マスタ一覧の並び順を組み立てる。一覧のページ取得（listMastersAndCount）とCSV出力の全件取得
// （listMastersForExport）で同じ並び順にする必要があるため、ここへ1か所にまとめている。
function buildMasterOrderBy(
  sort: MasterSortField,
  order: SortOrder,
): Prisma.MasterOrderByWithRelationInput[] {
  // 選んだ並び順を優先しつつ、並び替えの基準となる値が同じ行どうしの順番が
  // 実行のたびに変わらないよう、マスタコードなども並び順に加えている
  return sort === "category"
    ? [{ category: { name: order } }, { code: "asc" }]
    : sort === "code"
      ? [{ code: order }, { category: { name: "asc" } }]
      : [{ content: order }, { category: { name: "asc" } }, { code: "asc" }];
}

// マスタ分類一覧の並び順を組み立てる（マスタ一覧の buildMasterOrderBy の分類版）。
function buildCategoryOrderBy(
  sort: MasterCategorySortField,
  order: SortOrder,
): Prisma.MasterCategoryOrderByWithRelationInput[] {
  // 分類コードは連番をそのまま使っているため、コード順の並び替えは連番の並び替えで代用できる
  const primaryOrder: Prisma.MasterCategoryOrderByWithRelationInput =
    sort === "code"
      ? { id: order }
      : sort === "name"
        ? { name: order }
        : { masters: { _count: order } };
  // コード順以外は同じ値の行が出るため、順番が毎回変わらないよう連番も並び順に加える
  return sort === "code" ? [primaryOrder] : [primaryOrder, { id: "asc" }];
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
    const orderBy = buildMasterOrderBy(sort, order);

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

  // CSVダウンロード用に、検索条件に一致するマスタを全件取得する（ページングなし・§13.5.2）。
  // 依頼時点で件数が上限（MASTER_EXPORT_MAX_ROWS）以下であることを確認済みのため、ここでは上限件数を
  // 保険として take に設定するだけで、件数の再確認は行わない（§13.8）。
  listMastersForExport(
    filters: MasterListFilters,
    sort: MasterSortField,
    order: SortOrder,
  ): Promise<MasterDetailRecord[]> {
    return prisma.master.findMany({
      where: buildMasterWhere(filters),
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
      orderBy: buildMasterOrderBy(sort, order),
      take: MASTER_EXPORT_MAX_ROWS,
    });
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
    const orderBy = buildCategoryOrderBy(sort, order);
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

  // CSVダウンロード用に、マスタ分類を全件取得する（listMastersForExport の分類版）。
  listCategoriesForExport(
    sort: MasterCategorySortField,
    order: SortOrder,
  ): Promise<MasterCategoryDetailRecord[]> {
    return prisma.masterCategory.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        createdBy: true,
        updatedAt: true,
        updatedBy: true,
        _count: { select: { masters: true } },
      },
      orderBy: buildCategoryOrderBy(sort, order),
      take: MASTER_EXPORT_MAX_ROWS,
    });
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

  // マスタ情報Excel取得（MST-11）の実行履歴を、依頼日時の降順で1ページ分取得し、あわせて全体の件数も返す。
  // 検索条件を持たない一覧のため、他の一覧と異なり where は組み立てない。
  async listExcelExportsAndCount(
    skip: number,
    take: number,
  ): Promise<[MasterExcelExport[], number]> {
    return Promise.all([
      prisma.masterExcelExport.findMany({
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.masterExcelExport.count(),
    ]);
  },

  // マスタ情報Excel取得の実行履歴を、IDで1件取得する。
  // ダウンロードの受け取り（Route Handler）で、状態・保存先・保持期限を確かめるために使う。
  // 見つからない場合は null を返し、その扱いは呼び出し側（service）に任せる。
  findExcelExportById(id: string): Promise<MasterExcelExport | null> {
    return prisma.masterExcelExport.findUnique({ where: { id } });
  },

  // マスタ情報Excel取得の実行履歴を「受付済み(QUEUED)」で1件作る。
  // 状態の初期値はスキーマ側の @default("QUEUED") に任せ、ここでは指定しない。
  createExcelExport(data: { requestedBy: string }): Promise<MasterExcelExport> {
    return prisma.masterExcelExport.create({ data });
  },

  // マスタ情報Excel取得の実行履歴を「受付済み(QUEUED)」から「作成中(RUNNING)」へ進める。
  // 「受付済み」のときだけ進み、進められたかどうかを true / false で返す。
  // Cloud Run Jobsは同じ依頼を最大3回まで実行し直すことがあるが、2回目以降はここが false になるため、
  // ファイルが二重に作られることはない（設計書§40.7.3）。
  async markExcelExportRunning(id: string): Promise<boolean> {
    const result = await prisma.masterExcelExport.updateMany({
      where: { id, status: "QUEUED" satisfies MasterExcelExportStatus },
      data: { status: "RUNNING" satisfies MasterExcelExportStatus, startedAt: new Date() },
    });
    return result.count === 1;
  },

  // 実行履歴を「完了(READY)」にし、出力できた件数・保存先・取得できる期限を記録する。
  markExcelExportReady(
    id: string,
    data: {
      filePath: string;
      fileName: string;
      categoryRowCount: number;
      masterRowCount: number;
      finishedAt: Date;
      expiresAt: Date;
    },
  ): Promise<MasterExcelExport> {
    return prisma.masterExcelExport.update({
      where: { id },
      data: { status: "READY" satisfies MasterExcelExportStatus, ...data },
    });
  },

  // 実行履歴を「失敗(FAILED)」にし、失敗の種類を記録する。
  // 終わった日時も一緒に残すことで、どこまで動いてから失敗したのかを後から確認できるようにする。
  markExcelExportFailed(id: string, errorCode: string): Promise<MasterExcelExport> {
    return prisma.masterExcelExport.update({
      where: { id },
      data: {
        status: "FAILED" satisfies MasterExcelExportStatus,
        errorCode,
        finishedAt: new Date(),
      },
    });
  },

  // 保持期限（expiresAt）を過ぎているのに、まだファイルの保存先（filePath）が残っている行を、
  // 期限が古いものから最大 MASTER_EXCEL_EXPORT_CLEANUP_MAX_FILES 件だけ取得する。
  // 掃除処理（jobs.ts）がこの一覧をもとに、ストレージ上の実体を削除する（設計書§40.9）。
  async listExpiredExcelExportFiles(now: Date): Promise<MasterExcelExportFileRecord[]> {
    const rows = await prisma.masterExcelExport.findMany({
      where: {
        status: "READY" satisfies MasterExcelExportStatus,
        expiresAt: { lt: now },
        filePath: { not: null },
      },
      select: { id: true, filePath: true },
      orderBy: { expiresAt: "asc" },
      take: MASTER_EXCEL_EXPORT_CLEANUP_MAX_FILES,
    });
    // where句でfilePathが残っている行だけに絞り込んでいるため、ここで確実にある値として詰め替える
    return rows.map((row) => ({ id: row.id, filePath: row.filePath as string }));
  },

  // 掃除処理がストレージ上の実体を削除し終えた行について、保存先の情報（filePath / fileName）を
  // 空にする。履歴の行自体は削除しない（一覧には「期限切れ」のまま残る。設計書§40.9）。
  // すでに空になっている行を対象から外すことで、同じ行を何度も処理済みとして数えないようにする。
  async markExcelExportFileRemoved(id: string): Promise<boolean> {
    const result = await prisma.masterExcelExport.updateMany({
      where: { id, filePath: { not: null } },
      data: { filePath: null, fileName: null },
    });
    return result.count === 1;
  },
};
