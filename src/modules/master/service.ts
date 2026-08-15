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
  MASTER_EXPORT_MAX_ROWS,
  MASTER_EXPORT_QUEUE,
  MASTER_EXPORT_RETENTION_HOURS,
} from "@/modules/master/types";
import type {
  MasterCategoryDetail,
  MasterCategoryOption,
  MasterCategorySortField,
  MasterCategorySummary,
  MasterDetail,
  MasterExportRequest,
  MasterExportStatus,
  MasterExportTarget,
  MasterSearchCriteria,
  MasterSortField,
  MasterSummary,
} from "@/modules/master/types";
import type {
  CreateMasterCategoryInput,
  CreateMasterInput,
  DeleteMasterCategoryInput,
  DeleteMasterInput,
  UpdateMasterCategoryInput,
  UpdateMasterInput,
} from "@/modules/master/validation";
import { paginated, toSkipTake, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { AppError, isAppError } from "@/shared/errors/app-error";
import { getBoss } from "@/shared/jobs/boss";
import { invokeWorker } from "@/shared/jobs/invoke-worker";
import { storage } from "@/shared/storage";
import { Prisma } from "@prisma/client";

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

/** 分類詳細画面のデータを作る。一覧の1行分の内容に、いつ誰が登録・更新したかの記録を加える */
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

/** マスタ詳細画面のデータを作る。一覧の1行分の内容に、いつ誰が登録・更新したかの記録を加える */
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

// 指定された依頼が存在しない、または依頼した本人と異なるときのエラー（§13.5.3）。
// 他人の依頼が存在することを知らせないため、403ではなく404にする。
function masterExportNotFound(): AppError {
  return new AppError("MASTER_EXPORT_NOT_FOUND", 404, "指定されたダウンロードが見つかりません");
}

// 生成がまだ終わっていない（READYでない）のに受け取ろうとしたときのエラー（§13.10.2）。
// 通常は状態確認でREADYを確認してから受け取りを呼ぶため、画面には見せない想定のエラーである。
function masterExportNotReady(): AppError {
  return new AppError("MASTER_EXPORT_NOT_READY", 409, "まだ生成が終わっていません");
}

/**
 * 保持期限（MASTER_EXPORT_RETENTION_HOURS）を過ぎた生成物を掃除する（§13.9.2）。
 * 受け取られなかった、または生成に失敗して残ったままの MasterExport をまとめて片付ける。
 * ストレージ側の削除に失敗しても、行の削除は続ける。取り残しは次回また掃除の対象になるため。
 */
async function cleanupExpiredExports(): Promise<void> {
  const cutoff = new Date(Date.now() - MASTER_EXPORT_RETENTION_HOURS * 60 * 60 * 1000);
  const expired = await masterRepository.findExpiredExports(cutoff);
  if (expired.length === 0) return;

  await Promise.all(
    expired
      .filter((row) => row.filePath)
      .map((row) =>
        storage.remove(row.filePath as string).catch(() => {
          // ファイルが既に無い等の理由で消せなくても、行の削除は止めない
        }),
      ),
  );
  await masterRepository.deleteExports(expired.map((row) => row.id));
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

  // CSVダウンロードを依頼する（§13.5.1）。マスタ一覧（MASTER）とマスタ分類一覧（MASTER_CATEGORY）の
  // どちらも同じ流れで扱うが、対象件数の数え方と検索条件の持たせ方だけが異なる。
  async requestExport(
    target: MasterExportTarget,
    criteria: MasterSearchCriteria,
    userId: string,
  ): Promise<MasterExportRequest> {
    const keyword = criteria.keyword?.trim() || undefined;
    const count =
      target === "MASTER"
        ? await masterRepository.countMasters({ categoryId: criteria.categoryId, keyword })
        : await masterRepository.countCategories();
    if (count > MASTER_EXPORT_MAX_ROWS) {
      throw masterExportLimitExceeded(count, MASTER_EXPORT_MAX_ROWS);
    }

    // 依頼のたびに、前回までの取り残し（受け取られなかった生成物）を片付ける
    await cleanupExpiredExports();

    const exportRow = await masterRepository.createExport({
      target,
      categoryId: target === "MASTER" ? criteria.categoryId : undefined,
      keyword: target === "MASTER" ? keyword : undefined,
      requestedBy: userId,
    });

    // 検索条件は MasterExport 側に持たせているため、ジョブには exportId だけを積む（§13.5.1）。
    // キューは worker 側（工程16）で先に作られる想定だが、その順序に依存しないよう、
    // 送る前に自分でも作成しておく（既にあれば何もしない）。
    // start() は2回目以降すぐ返る作りのため、リクエストのたびに呼んでも問題ない。
    // worker とは別プロセス（別の PgBoss インスタンス）であり、ここで開始しないと
    // 接続が開かれないまま createQueue / send が失敗する。
    const boss = getBoss();
    await boss.start();
    await boss.createQueue(MASTER_EXPORT_QUEUE);
    await boss.send(MASTER_EXPORT_QUEUE, { exportId: exportRow.id });

    // 本番のときだけ、積んだジョブを処理させるため worker（Cloud Run Jobs）を起動する（§30.1.7）。
    // ローカルは常駐 worker が既に動いているため何もしない（invokeWorker 内で判定）。
    await invokeWorker();

    return { exportId: exportRow.id };
  },

  /**
   * CSVを実際に生成する（worker から呼ばれる。§13.5.2）。
   * 依頼が見つからない、または既に処理済み（QUEUEDでない）場合は何もしない。
   * これは同じジョブが二重に実行されたときの保険であり、通常の流れでは起きない。
   */
  async processExport(exportId: string): Promise<void> {
    const exportRow = await masterRepository.findExportById(exportId);
    if (!exportRow) return;
    if (!(await masterRepository.markExportRunning(exportId))) return;

    try {
      const target = exportRow.target as MasterExportTarget;
      let csv: string;
      let rowCount: number;
      if (target === "MASTER") {
        // 並び順は一覧（MST-01）の既定と同じにする（§13.2）。件数の再確認は行わない（§13.8）。
        const rows = await masterRepository.listMastersForExport(
          {
            categoryId: exportRow.categoryId ?? undefined,
            keyword: exportRow.keyword ?? undefined,
          },
          "category",
          "asc",
        );
        csv = buildMasterExportCsv(rows.map(toMasterDetail));
        rowCount = rows.length;
      } else {
        const rows = await masterRepository.listCategoriesForExport("code", "asc");
        csv = buildMasterCategoryExportCsv(rows.map(toCategoryDetail));
        rowCount = rows.length;
      }

      // 保存パスは exportId で一意にする。利用者へ見せるファイル名とは別物（§13.9.1）。
      const filePath = `master-export/${exportId}.csv`;
      const fileName = buildMasterExportFileName(target, new Date());
      await storage.upload(filePath, Buffer.from(csv, "utf-8"), "text/csv");
      await masterRepository.updateExportReady(exportId, { filePath, fileName, rowCount });
    } catch (err) {
      // 記録だけここで行い、ログは呼び出し元（withJob）が処理境界で1回だけ出す
      const errorCode = isAppError(err) ? err.code : "MASTER_EXPORT_FAILED";
      await masterRepository.updateExportFailed(exportId, errorCode);
      throw err;
    }
  },

  // CSVの生成状況を問い合わせる（画面から2秒間隔で呼ばれる。§13.5.3・§13.10.1）。
  // 依頼が見つからない、または依頼した本人と異なる場合は同じエラーにする（本人以外へ存在を知らせないため）。
  async getExportStatus(exportId: string, userId: string): Promise<MasterExportStatus> {
    const exportRow = await masterRepository.findExportById(exportId);
    if (!exportRow || exportRow.requestedBy !== userId) {
      throw masterExportNotFound();
    }
    return {
      status: exportRow.status as MasterExportStatus["status"],
      errorCode: exportRow.errorCode ?? undefined,
    };
  },

  // 生成済みのCSVを受け取る（§13.5.3）。本人確認のうえファイルを取得し、
  // 取り残しを残さないよう、返した直後にファイルと MasterExport の行を削除する（§13.9.2）。
  async downloadExport(
    exportId: string,
    userId: string,
  ): Promise<{ fileName: string; data: Buffer }> {
    const exportRow = await masterRepository.findExportById(exportId);
    if (!exportRow || exportRow.requestedBy !== userId) {
      throw masterExportNotFound();
    }
    if (exportRow.status !== "READY" || !exportRow.filePath || !exportRow.fileName) {
      throw masterExportNotReady();
    }

    const data = await storage.download(exportRow.filePath);
    await storage.remove(exportRow.filePath).catch(() => {
      // 消せなくても応答は成功として返す。取り残しは次回依頼時の掃除で回収する（§13.9.2）
    });
    await masterRepository.deleteExports([exportRow.id]);

    return { fileName: exportRow.fileName, data };
  },

  cleanupExpiredExports,
};
