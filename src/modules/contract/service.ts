import { masterService } from "@/modules/master";
import { contractRepository, type ContractWithParty } from "@/modules/contract/repository";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  type ContractDetail,
  type ContractSearchCriteria,
  type ContractSortField,
  type ContractSummary,
} from "@/modules/contract/types";
import type {
  CreateContractInput,
  DeleteContractInput,
  UpdateContractInput,
} from "@/modules/contract/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { AppError, Errors } from "@/shared/errors/app-error";

// マスタから解決できなかった（未選択・削除済みなどで内容を取得できなかった）場合の表示文言。
// docs/specs/02_basic-design/master/01_データベース.md §01.1.4 の規約に合わせる。
const UNSET_LABEL = "未設定";

/** データベースから取得した契約を画面用の形に詰め替える。契約先名は別テーブルにあるため同じ階層へ移す */
function toSummary(c: ContractWithParty, labelById: Map<number, string>): ContractSummary {
  return {
    id: c.id,
    partyId: c.partyId,
    partyName: c.party.name,
    title: c.title,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
    categoryMasterId: c.categoryMasterId,
    categoryLabel:
      (c.categoryMasterId !== null ? labelById.get(c.categoryMasterId) : undefined) ?? UNSET_LABEL,
  };
}

// 契約分類として選ばれたマスタが、実際に契約分類（CONTRACT_TYPE）配下のものかを確認する。
// 未選択（undefined）の場合は確認不要。
async function assertCategoryValid(categoryMasterId: number | undefined): Promise<void> {
  if (categoryMasterId === undefined) return;
  await masterService.assertMasterInCategoryCode(
    categoryMasterId,
    CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  );
}

// 選択された契約先が見つからないときのエラー。マスタ機能のMASTER_NOT_FOUND等と異なり
// Errorsファクトリを使わず直接組み立てる（§00.6）。
function partyNotFound(partyId: string): AppError {
  return new AppError("PARTY_NOT_FOUND", 404, "対象の契約先が見つかりません", { partyId });
}

// 選択された契約先が現在も存在することを確認し、名称を返す（§21.1.2・§21.2.3）。
async function assertPartyExists(partyId: string): Promise<string> {
  const name = await contractRepository.findPartyName(partyId);
  if (name === null) throw partyNotFound(partyId);
  return name;
}

// 対象の契約が見つからないときのエラー（すでに削除された、URLの指定が誤っている、など）
function contractNotFound(id: string): AppError {
  return new AppError("CONTRACT_NOT_FOUND", 404, "対象の契約が見つかりません", { id });
}

// 契約の更新・削除画面を開いてから保存するまでの間に、他の利用者が先に更新・削除していたときのエラー
function contractConcurrentUpdate(id: string): AppError {
  return new AppError(
    "CONTRACT_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してください",
    { id },
  );
}

export const contractService = {
  // 契約の一覧を、検索条件に従って指定されたページの分だけ取得する。
  async list(
    criteria: ContractSearchCriteria,
    page: number,
    pageSize: number,
    sort: ContractSortField = "title",
    order: SortOrder = "asc",
  ): Promise<Paginated<ContractSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [contracts, total] = await contractRepository.listAndCount(
      {
        partyId: criteria.partyId,
        status: criteria.status,
        categoryMasterId: criteria.categoryMasterId,
      },
      skip,
      take,
      sort,
      order,
    );
    const ids = contracts.map((c) => c.categoryMasterId).filter((id): id is number => id !== null);
    const labelById = await masterService.resolveMasterContents(ids);
    return paginated(
      contracts.map((c) => toSummary(c, labelById)),
      total,
      { page, pageSize },
    );
  },

  // 詳細画面に表示する契約1件を取得する。
  // 見つからない場合はエラーにせず「無し」を返し、その後どう扱うか（404画面を出すなど）は呼び出し側に任せる。
  async findDetail(id: string): Promise<ContractDetail | null> {
    const contract = await contractRepository.findById(id);
    if (!contract) return null;
    const labelById = await masterService.resolveMasterContents(
      contract.categoryMasterId !== null ? [contract.categoryMasterId] : [],
    );
    return {
      ...toSummary(contract, labelById),
      createdAt: contract.createdAt,
      createdBy: contract.createdBy,
      updatedAt: contract.updatedAt,
      updatedBy: contract.updatedBy,
    };
  },

  // 確認画面を出す前に、選択された契約先・契約分類が有効かどうかだけを確認したい場面があるため、
  // 上で定義した確認用の関数を、そのまま外からも呼べるように公開している（マスタ機能と同じ考え方）。
  assertPartyExists,
  assertCategoryValid,

  // 契約を新規登録し、画面に表示する形にして返す。
  // 登録直後の結果には契約先の名前が含まれないため、改めて取得し直している。
  // createdBy・updatedByには登録を実行した利用者のユーザーIDを設定する。
  async create(input: CreateContractInput, userId: string): Promise<ContractSummary> {
    await assertPartyExists(input.partyId);
    await assertCategoryValid(input.categoryMasterId);
    const contract = await contractRepository.create({
      party: { connect: { id: input.partyId } },
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
      categoryMasterId: input.categoryMasterId ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    const withParty = await contractRepository.findById(contract.id);
    if (!withParty) throw Errors.notFound("契約が見つかりません");
    const labelById = await masterService.resolveMasterContents(
      withParty.categoryMasterId !== null ? [withParty.categoryMasterId] : [],
    );
    return toSummary(withParty, labelById);
  },

  // 契約を更新する。
  // 契約先の変更はここでは扱わない（登録時に決めた契約先を変えられないようにするため）。
  // 更新画面を開いてから保存するまでの間に、他の利用者が先に更新・削除していないかを、
  // 保存前の確認と、条件付きの更新（updateIfUnchanged）の2段階で確かめる（契約先と同じ方式。§23.2）。
  async update(input: UpdateContractInput, userId: string): Promise<void> {
    const existing = await contractRepository.findById(input.id);
    if (!existing) throw contractNotFound(input.id);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw contractConcurrentUpdate(input.id);
    }

    await assertCategoryValid(input.categoryMasterId);

    const updated = await contractRepository.updateIfUnchanged(input.id, input.updatedAt, {
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
      categoryMasterId: input.categoryMasterId ?? null,
      updatedBy: userId,
    });
    if (!updated) {
      // 1件も更新されなかった場合、対象が削除されたのか、他の利用者に先に更新されたのかが分からない。
      // どちらなのかを判断して適切なメッセージを出すため、もう一度取得して確かめる。
      const current = await contractRepository.findById(input.id);
      if (!current) throw contractNotFound(input.id);
      throw contractConcurrentUpdate(input.id);
    }
  },

  // 契約を削除する。物理削除であり、元に戻せない。
  // 検証の順序は権限（呼び出し元のServer Actionで確認済み）→存在→同時更新の順とする（§24.2）。
  // 契約先の削除と異なり、依存関係のチェックは行わない（契約に紐づくContractItemを登録・参照する
  // 画面がまだ存在しないため。§00.9.1）。
  async remove(input: DeleteContractInput): Promise<{ title: string; partyName: string }> {
    const existing = await contractRepository.findById(input.id);
    if (!existing) throw contractNotFound(input.id);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw contractConcurrentUpdate(input.id);
    }

    const deleted = await contractRepository.deleteIfUnchanged(input.id, input.updatedAt);
    if (!deleted) {
      // 1件も削除されなかった場合、対象がすでに削除されたのか、他の利用者に先に更新されたのかが分からない。
      const current = await contractRepository.findById(input.id);
      if (!current) throw contractNotFound(input.id);
      throw contractConcurrentUpdate(input.id);
    }

    return { title: existing.title, partyName: existing.party.name };
  },
};
