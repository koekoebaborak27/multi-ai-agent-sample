import {
  buildMasterCategoryExportCsv,
  buildMasterExportCsv,
  buildMasterExportFileName,
} from "@/modules/master/export";
import {
  masterRepository,
  type MasterCategoryDetailRecord,
  type MasterCategoryListRecord,
  type MasterDetailRecord,
  type MasterListRecord,
} from "@/modules/master/repository";
import {
  MASTER_EXCEL_EXPORT_MAX_ROWS,
  MASTER_EXCEL_EXPORT_QUEUE,
  MASTER_EXPORT_MAX_ROWS,
} from "@/modules/master/types";
import type {
  MasterCategoryDetail,
  MasterCategoryOption,
  MasterCategorySortField,
  MasterCategorySummary,
  MasterDetail,
  MasterExcelExportJobData,
  MasterExcelExportRequest,
  MasterExcelExportStatus,
  MasterExcelExportSummary,
  MasterSearchCriteria,
  MasterSortField,
  MasterSummary,
} from "@/modules/master/types";
import { userService } from "@/modules/user/service";
import type {
  CreateMasterCategoryInput,
  CreateMasterInput,
  DeleteMasterCategoryInput,
  DeleteMasterInput,
  UpdateMasterCategoryInput,
  UpdateMasterInput,
} from "@/modules/master/validation";
import { paginated, toSkipTake, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { AppError } from "@/shared/errors/app-error";
import { getBoss } from "@/shared/jobs/boss";
import { storage } from "@/shared/storage";
import { Prisma, type MasterExcelExport } from "@prisma/client";

// マスタ分類コードの桁数。
// コードは分類ごとの連番をそのまま使うため、桁数はこの値だけで決まる。
// 分類が 9999 件を超える見込みが出たら、この値と画面の表示幅を合わせて見直す。
const MASTER_CATEGORY_CODE_LENGTH = 4;

/** 分類の連番を「0042」のような表示用のコード文字列に変換する */
export function formatMasterCategoryCode(id: number): string {
  return String(id).padStart(MASTER_CATEGORY_CODE_LENGTH, "0");
}

// ここから 4 つの関数は、データベースから取得したデータを画面用の形に詰め替える。
// データベースの中身をそのまま画面へ渡さないことで、テーブルの項目が変わっても
// 画面側の修正がこのファイルの中で済むようにしている。

/** 分類一覧の1行分のデータを作る。表示用コードと、その分類に属するマスタの件数も一緒に持たせる */
function toCategorySummary(category: MasterCategoryListRecord): MasterCategorySummary {
  return {
    id: category.id,
    code: formatMasterCategoryCode(category.id),
    name: category.name,
    masterCount: category._count.masters,
  };
}

/**
 * 分類詳細画面のデータを作る。一覧の1行分の内容に、いつ誰が登録・更新したかの記録を加える。
 * マスタ情報Excel取得（jobs.ts）でも同じ詰め替えを使うため、export している。
 */
export function toCategoryDetail(category: MasterCategoryDetailRecord): MasterCategoryDetail {
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

/** マスタ一覧の1行分のデータを作る。画面に分類名も表示するため、別テーブルにある分類名を同じ階層へ移す */
function toMasterSummary(master: MasterListRecord): MasterSummary {
  return {
    id: master.id,
    categoryId: master.categoryId,
    categoryName: master.category.name,
    code: master.code,
    content: master.content,
  };
}

/**
 * マスタ詳細画面のデータを作る。一覧の1行分の内容に、いつ誰が登録・更新したかの記録を加える。
 * マスタ情報Excel取得（jobs.ts）でも同じ詰め替えを使うため、export している。
 */
export function toMasterDetail(master: MasterDetailRecord): MasterDetail {
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

// マスタ情報Excel取得の状態値（QUEUED/RUNNING/READY/FAILED）を、画面に出す日本語ラベルへ変換する。
// READYでも保持期限（expiresAt）を過ぎている行は「期限切れ」という別のラベルにする（設計書§40.9）。
function toExcelExportStatusLabel(status: MasterExcelExportStatus, expired: boolean): string {
  if (status === "READY") return expired ? "期限切れ" : "完了";
  const labels: Record<Exclude<MasterExcelExportStatus, "READY">, string> = {
    QUEUED: "受付済み",
    RUNNING: "作成中",
    FAILED: "失敗",
  };
  return labels[status];
}

// 失敗時に一覧へ出す、利用者向けのエラーメッセージを組み立てる。
// 内部のエラーコード（errorCode）をそのまま画面に出さないようにするための変換。
function toExcelExportErrorMessage(errorCode: string | null): string | null {
  return errorCode ? "Excelの作成に失敗しました。時間をおいてもう一度お試しください。" : null;
}

// 完了(READY)した実行履歴が、保持期限（expiresAt）を過ぎているかどうかを判定する（設計書§40.9）。
// 一覧表示（toExcelExportSummary）とダウンロード（getExcelExportDownload）の両方から呼び、
// 判定式が2か所に分かれてずれる事故を防ぐ。
function isExcelExportExpired(row: MasterExcelExport, now: Date): boolean {
  return row.status === "READY" && !!row.expiresAt && row.expiresAt.getTime() < now.getTime();
}

/** マスタ情報Excel取得の実行履歴1件を、一覧に表示する形へ詰め替える */
function toExcelExportSummary(
  row: MasterExcelExport,
  requestedByName: string,
  now: Date,
): MasterExcelExportSummary {
  const status = row.status as MasterExcelExportStatus;
  const expired = isExcelExportExpired(row, now);
  return {
    id: row.id,
    status,
    statusLabel: toExcelExportStatusLabel(status, expired),
    expired,
    requestedByName,
    createdAt: row.createdAt,
    categoryRowCount: row.categoryRowCount,
    masterRowCount: row.masterRowCount,
    errorMessage: toExcelExportErrorMessage(row.errorCode),
    // ダウンロードを実際に受け取るRoute Handlerは次工程で追加する。
    // ここではリンク先だけ先に決めておき、次工程でRoute Handlerを追加するだけで動くようにする。
    downloadHref: status === "READY" && !expired ? `/api/master/exports/${row.id}/download` : null,
  };
}

// ここから 6 つの関数は、処理を続けられない理由ごとにエラーを組み立てる。
// エラーの種類を表す名前・画面に出すメッセージをここへまとめておくことで、
// 呼び出し側はエラーを発生させるだけでよく、メッセージを何度も書かずに済む。

/** 同じ名前の分類がすでに登録されているときのエラー（新規作成・名前変更の両方で使う） */
function masterCategoryConflict(name: string): AppError {
  return new AppError("MASTER_CATEGORY_CONFLICT", 409, "同じ名前のマスタ分類が登録されています", {
    name,
  });
}

/** 指定された分類が見つからないときのエラー（すでに削除された、URLの指定が誤っている、など） */
function masterCategoryNotFound(id: number): AppError {
  return new AppError("MASTER_CATEGORY_NOT_FOUND", 404, "対象のマスタ分類が見つかりません", { id });
}

/** 分類の更新画面を開いてから保存するまでの間に、他の利用者が先に更新していたときのエラー */
function masterCategoryConcurrentUpdate(id: number): AppError {
  return new AppError(
    "MASTER_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
    { id },
  );
}

/** 指定されたマスタが見つからないときのエラー（すでに削除された、URLの指定が誤っている、など） */
function masterNotFound(id: number): AppError {
  return new AppError("MASTER_NOT_FOUND", 404, "対象のマスタが見つかりません", { id });
}

/** マスタの更新画面を開いてから保存するまでの間に、他の利用者が先に更新していたときのエラー */
function masterConcurrentUpdate(id: number): AppError {
  return new AppError(
    "MASTER_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
    { id },
  );
}

/** 配下にマスタが1件でも残っているマスタ分類を削除しようとしたときのエラー（件数は利用者への案内に使う） */
function masterCategoryHasMasters(id: number, masterCount: number): AppError {
  return new AppError(
    "MASTER_CATEGORY_HAS_MASTERS",
    409,
    "配下にマスタが登録されているため削除できません。先に配下のマスタを削除してください。",
    { id, masterCount },
  );
}

/** 同じ分類の中にマスタコードが重複しているときのエラー（コードは分類ごとに重複しない決まり） */
function masterCodeConflict(categoryId: number, code: string): AppError {
  return new AppError(
    "MASTER_CODE_CONFLICT",
    409,
    "同じマスタ分類に同じマスタコードが登録されています",
    { categoryId, code },
  );
}

/** CSVダウンロードの対象件数が上限（MASTER_EXPORT_MAX_ROWS）を超えているときのエラー（§13.8） */
function masterExportLimitExceeded(count: number, max: number): AppError {
  return new AppError(
    "MASTER_EXPORT_LIMIT_EXCEEDED",
    422,
    `対象が${count}件あります。${max}件以下になるよう検索条件で絞り込んでください`,
    { count, max },
  );
}

/** マスタ情報Excel取得の対象件数（分類・マスタのいずれか）が上限を超えているときのエラー（設計書§40.8） */
function masterExcelExportLimitExceeded(
  categoryCount: number,
  masterCount: number,
  max: number,
): AppError {
  return new AppError(
    "MASTER_EXCEL_EXPORT_LIMIT_EXCEEDED",
    422,
    "対象の件数が多く、Excelを作成できません。管理者に相談してください",
    { categoryCount, masterCount, max },
  );
}

/**
 * ダウンロードしようとした実行履歴が見つからない、または受け取れる状態でないときのエラー（設計書§40.10）。
 * 「履歴自体が存在しない」「まだ作成中／失敗した履歴のURLを直接開いた」「保存先の情報が
 * 記録されていない（データの不整合）」の3パターンをまとめて扱う。利用者からはどれも
 * 「受け取れるファイルが無い」という同じ結果であり、対応も変わらないため。
 * status には確認できた場合の内部状態を渡しておくと、記録（ログ）から原因を絞り込める。
 */
function masterExcelExportNotFound(exportId: string, status?: string): AppError {
  return new AppError("MASTER_EXCEL_EXPORT_NOT_FOUND", 404, "対象の実行履歴が見つかりません", {
    exportId,
    status,
  });
}

/** 保持期限（作成から7日）を過ぎたファイルをダウンロードしようとしたときのエラー（設計書§40.9） */
function masterExcelExportExpired(exportId: string, expiresAt: Date): AppError {
  return new AppError("MASTER_EXCEL_EXPORT_EXPIRED", 410, "ファイルの有効期限が切れています", {
    exportId,
    expiresAt,
  });
}

/**
 * 分類名が他の分類と重複していないか確認し、重複していればエラーにする。
 * 更新のときは自分自身の分類を excludeId で指定する。
 * そうしないと、名前を変えずに保存しただけで「重複している」と判定されてしまうため。
 */
async function assertCategoryNameAvailable(name: string, excludeId?: number): Promise<void> {
  const existing = await masterRepository.findCategoryByName(name);
  if (existing && existing.id !== excludeId) throw masterCategoryConflict(name);
}

/** 指定された分類が実際に存在するか確認し、無ければエラーにする（マスタの作成・更新の前に使う） */
async function assertCategoryExists(categoryId: number): Promise<void> {
  const category = await masterRepository.findCategoryById(categoryId);
  if (!category) throw masterCategoryNotFound(categoryId);
}

/**
 * 同じ分類の中でマスタコードが重複していないか確認し、重複していればエラーにする。
 * 更新のときは自分自身のマスタを excludeId で指定する。
 * そうしないと、コードを変えずに保存しただけで「重複している」と判定されてしまうため。
 */
async function assertMasterCodeAvailable(
  categoryId: number,
  code: string,
  excludeId?: number,
): Promise<void> {
  const existing = await masterRepository.findMasterByCategoryAndCode(categoryId, code);
  if (existing && existing.id !== excludeId) throw masterCodeConflict(categoryId, code);
}

export const masterService = {
  // マスタの一覧を、指定されたページの分だけ取得する。
  // 検索条件・ページ番号・並び順を受け取り、キーワードは前後の空白を取り除いてから使う
  // （空になった場合は「条件なし」として扱う）。
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

  // 詳細画面に表示するマスタ1件を取得する。
  // 見つからない場合はエラーにせず「無し」を返し、その後どう扱うか（画面に何を出すか）は呼び出し側に任せる。
  async findMasterDetail(id: number): Promise<MasterDetail | null> {
    const master = await masterRepository.findMasterById(id);
    return master ? toMasterDetail(master) : null;
  },

  // 分類プルダウン（検索条件・作成・更新フォームで使用）に表示する、すべての分類を返す。
  // 件数が多くならない前提のため、ページに分けず全件返す。
  async listCategoryOptions(): Promise<MasterCategoryOption[]> {
    const categories = await masterRepository.listCategoryOptions();
    return categories.map((category) => ({
      id: category.id,
      code: formatMasterCategoryCode(category.id),
      name: category.name,
    }));
  },

  // マスタ分類の一覧を、指定されたページの分だけ取得する（マスタ一覧の分類版）。
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

  // 分類詳細画面に表示する分類1件を取得する（マスタ詳細の分類版）。
  async findCategoryDetail(id: number): Promise<MasterCategoryDetail | null> {
    const category = await masterRepository.findCategoryByIdWithCount(id);
    return category ? toCategoryDetail(category) : null;
  },

  // 確認画面を出す前に入力内容の確認だけを行いたい場面があるため、
  // 上で定義した確認用の関数を、そのまま外からも呼べるように公開している。
  assertCategoryExists,

  assertMasterCodeAvailable,

  // マスタを新規登録する。
  // 先に「分類が存在するか」「コードが重複していないか」を確認し、よくある入力ミスは分かりやすいメッセージで止める。
  // それでも登録に失敗した場合（ほぼ同時に他の利用者が登録したときなど）は、
  // データベースが返すエラーの種類を見て、同じく分かりやすいメッセージへ置き換える。
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
        // P2002 は重複エラー。確認した直後に、他の利用者が同じコードを登録したことを意味する
        if (error.code === "P2002") throw masterCodeConflict(input.categoryId, input.code);
        // P2003 は参照先が無いエラー。確認した直後に、登録先の分類が削除されたことを意味する
        if (error.code === "P2003") throw masterCategoryNotFound(input.categoryId);
      }
      throw error;
    }
  },

  // マスタを更新する。
  // 新規登録と違い、「更新画面を開いてから保存するまでの間に、他の利用者が先に更新していないか」を確認する。
  // 確認は 2 段階に分かれている。
  //   1 段階目: 保存前に最終更新日時を見比べ、すでに他の利用者が更新していればここで止める。
  //   2 段階目: 実際の更新を「最終更新日時が画面を開いた時点のままなら更新する」という条件付きで行う。
  //             1 段階目の確認から実際の更新までのわずかな間にも他の利用者が更新できてしまうため、
  //             最終的な判断はデータベース側の条件に任せている。
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
        // 1 件も更新されなかった場合、対象が削除されたのか、他の利用者に先に更新されたのかが分からない。
        // どちらなのかを判断して適切なメッセージを出すため、もう一度取得して確かめる。
        const current = await masterRepository.findMasterById(input.masterId);
        if (!current) throw masterNotFound(input.masterId);
        throw masterConcurrentUpdate(input.masterId);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // P2002 は重複エラー。確認した直後に、他の利用者が同じコードへ変更したことを意味する
        if (error.code === "P2002") throw masterCodeConflict(input.categoryId, input.code);
        // P2003 は参照先が無いエラー。確認した直後に、変更先の分類が削除されたことを意味する
        if (error.code === "P2003") throw masterCategoryNotFound(input.categoryId);
      }
      throw error;
    }
  },

  // マスタを削除する。物理削除であり、元に戻せない。
  // 更新と同じく、詳細画面を開いてから削除するまでの間に他の利用者が
  // 先に更新・削除していないかを確認してから削除する。
  // 呼び出し元がログへ残せるよう、削除した対象の分類名・コード・内容を返す。
  async deleteMaster(
    input: DeleteMasterInput,
  ): Promise<{ categoryName: string; code: string; content: string }> {
    const existing = await masterRepository.findMasterById(input.masterId);
    if (!existing) throw masterNotFound(input.masterId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw masterConcurrentUpdate(input.masterId);
    }

    const deleted = await masterRepository.deleteMasterIfUnchanged(input.masterId, input.updatedAt);
    if (!deleted) {
      // 1件も削除されなかった場合、対象がすでに削除されたのか、他の利用者に先に更新されたのかが分からない。
      // 物理削除では「存在しない」と「既に削除された」を区別できないため、両者を同一のエラーとして扱う。
      const current = await masterRepository.findMasterById(input.masterId);
      if (!current) throw masterNotFound(input.masterId);
      throw masterConcurrentUpdate(input.masterId);
    }

    return {
      categoryName: existing.category.name,
      code: existing.code,
      content: existing.content,
    };
  },

  assertCategoryNameAvailable,

  // マスタ分類を新規登録する。
  // マスタの新規登録と同じく、先に名前の重複を確認し、それでも失敗した場合はデータベースのエラーを見て判断する。
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
        // 登録した直後の分類にはマスタが1件も属していないので、数え直さず 0 とする
        masterCount: 0,
      };
    } catch (error) {
      // P2002 は重複エラー。確認した直後に、他の利用者が同じ名前で登録したことを意味する
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw masterCategoryConflict(input.name);
      }
      throw error;
    }
  },

  // マスタ分類を更新する。
  // マスタの更新と同じく、最終更新日時を見比べる確認と、条件付きの更新の 2 段階で他の利用者との重なりを防ぐ。
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
        // マスタの更新と同様、1 件も更新されなかった原因が「削除された」のか
        // 「他の利用者に先に更新された」のかを、もう一度取得して確かめる
        const current = await masterRepository.findCategoryByIdWithCount(input.categoryId);
        if (!current) throw masterCategoryNotFound(input.categoryId);
        throw masterCategoryConcurrentUpdate(input.categoryId);
      }
    } catch (error) {
      // P2002 は重複エラー。確認した直後に、他の利用者が同じ名前へ変更したことを意味する
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw masterCategoryConflict(input.name);
      }
      throw error;
    }
  },

  // マスタ分類を削除する。物理削除であり、元に戻せない。
  // 配下にマスタが1件でも存在する場合は削除できない。件数確認と削除は同じトランザクション内で行うが、
  // それでも競合が起きた場合は、Master.categoryId の外部キー制約が最終的な歯止めとなる
  // （P2003 を検知して MASTER_CATEGORY_HAS_MASTERS へ変換する）。
  async deleteCategory(input: DeleteMasterCategoryInput): Promise<{ code: string; name: string }> {
    const existing = await masterRepository.findCategoryByIdWithCount(input.categoryId);
    if (!existing) throw masterCategoryNotFound(input.categoryId);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw masterCategoryConcurrentUpdate(input.categoryId);
    }

    if (existing._count.masters > 0) {
      throw masterCategoryHasMasters(input.categoryId, existing._count.masters);
    }

    try {
      const deleted = await masterRepository.deleteCategoryIfUnchanged(
        input.categoryId,
        input.updatedAt,
      );
      if (!deleted) {
        // 1件も削除されなかった場合、対象がすでに削除されたのか、他の利用者に先に更新されたのかが分からない。
        // 物理削除では「存在しない」と「既に削除された」を区別できないため、両者を同一のエラーとして扱う。
        const current = await masterRepository.findCategoryByIdWithCount(input.categoryId);
        if (!current) throw masterCategoryNotFound(input.categoryId);
        throw masterCategoryConcurrentUpdate(input.categoryId);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        // 件数確認の直後に、他の利用者が同じ分類へマスタを登録したことを意味する
        const current = await masterRepository.findCategoryByIdWithCount(input.categoryId);
        throw masterCategoryHasMasters(input.categoryId, current?._count.masters ?? 1);
      }
      throw error;
    }

    return { code: formatMasterCategoryCode(existing.id), name: existing.name };
  },

  // マスタ一覧（MST-01）のCSVをその場で作って返す。件数が上限を超えていれば作らずエラーにする。
  async exportMasterCsv(
    criteria: MasterSearchCriteria,
  ): Promise<{ fileName: string; data: Buffer }> {
    const keyword = criteria.keyword?.trim() || undefined;
    const count = await masterRepository.countMasters({ categoryId: criteria.categoryId, keyword });
    if (count > MASTER_EXPORT_MAX_ROWS) {
      throw masterExportLimitExceeded(count, MASTER_EXPORT_MAX_ROWS);
    }

    // 並び順は一覧（MST-01）の既定と同じにする（設計書§13.2）。
    const rows = await masterRepository.listMastersForExport(
      { categoryId: criteria.categoryId, keyword },
      "category",
      "asc",
    );
    const csv = buildMasterExportCsv(rows.map(toMasterDetail));
    const fileName = buildMasterExportFileName("MASTER", new Date());
    return { fileName, data: Buffer.from(csv, "utf-8") };
  },

  // マスタ分類一覧（MST-06）のCSVをその場で作って返す。検索条件が無いため常に全件が対象。
  async exportCategoryCsv(): Promise<{ fileName: string; data: Buffer }> {
    const count = await masterRepository.countCategories();
    if (count > MASTER_EXPORT_MAX_ROWS) {
      throw masterExportLimitExceeded(count, MASTER_EXPORT_MAX_ROWS);
    }

    const rows = await masterRepository.listCategoriesForExport("code", "asc");
    const csv = buildMasterCategoryExportCsv(rows.map(toCategoryDetail));
    const fileName = buildMasterExportFileName("MASTER_CATEGORY", new Date());
    return { fileName, data: Buffer.from(csv, "utf-8") };
  },

  // マスタ情報Excel取得（MST-11）の依頼を受け付ける。
  // 件数が上限を超えていなければ実行履歴を「受付済み」で1件作り、順番待ちの列（キュー）へ
  // 依頼を積んで、生成の完了を待たずにすぐ応答する（生成そのものはworker側が行う）。
  async requestExcelExport(userId: string): Promise<MasterExcelExportRequest> {
    const [categoryCount, masterCount] = await Promise.all([
      masterRepository.countCategories(),
      masterRepository.countMasters({}),
    ]);
    if (
      categoryCount > MASTER_EXCEL_EXPORT_MAX_ROWS ||
      masterCount > MASTER_EXCEL_EXPORT_MAX_ROWS
    ) {
      throw masterExcelExportLimitExceeded(
        categoryCount,
        masterCount,
        MASTER_EXCEL_EXPORT_MAX_ROWS,
      );
    }

    const record = await masterRepository.createExcelExport({ requestedBy: userId });

    const boss = getBoss();
    await boss.start();
    await boss.createQueue(MASTER_EXCEL_EXPORT_QUEUE);
    const jobData: MasterExcelExportJobData = { exportId: record.id };
    await boss.send(MASTER_EXCEL_EXPORT_QUEUE, jobData);

    return { exportId: record.id };
  },

  // マスタ情報Excel取得（MST-11）の実行履歴一覧を、指定されたページの分だけ取得する。
  // 依頼した利用者のID（requestedBy）はUserテーブルへのFKを張らない規約のため、
  // 一括で表示名へ解決してから（N+1を避ける）、画面表示用の形へ詰め替える。
  async listExcelExports(
    page: number,
    pageSize: number,
  ): Promise<Paginated<MasterExcelExportSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [rows, total] = await masterRepository.listExcelExportsAndCount(skip, take);
    const nameById = await userService.resolveDisplayNames(rows.map((row) => row.requestedBy));
    const now = new Date();
    const items = rows.map((row) =>
      toExcelExportSummary(row, nameById.get(row.requestedBy) ?? row.requestedBy, now),
    );
    return paginated(items, total, { page, pageSize });
  },

  /**
   * マスタ情報Excel取得（MST-11）で作られたファイルの中身を取り出す。
   * 履歴一覧の「ダウンロード」から呼ばれる（設計書§40.5.4）。署名URLは使わず、
   * このアプリ自身が保存先からファイルを読み出してそのまま渡す方式に統一している（設計書§40.9）。
   */
  async getExcelExportDownload(exportId: string): Promise<{ fileName: string; data: Buffer }> {
    const row = await masterRepository.findExcelExportById(exportId);
    if (!row) throw masterExcelExportNotFound(exportId);
    if (row.status !== "READY") throw masterExcelExportNotFound(exportId, row.status);

    // 期限切れの確認は、保存先からファイルを読み出すより必ず先に行う。期限が切れた
    // ファイルはworkerがまとめて削除する予定のため、読み出しを先にすると「期限切れです」
    // ではなく「取得に失敗しました」という分かりにくい応答になってしまう。
    const now = new Date();
    if (isExcelExportExpired(row, now)) {
      throw masterExcelExportExpired(exportId, row.expiresAt as Date);
    }
    if (!row.filePath || !row.fileName) throw masterExcelExportNotFound(exportId, row.status);

    const data = await storage.download(row.filePath);
    return { fileName: row.fileName, data };
  },
};
