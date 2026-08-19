import { masterService } from "@/modules/master";
import { contractRepository, type ContractWithParty } from "@/modules/contract/repository";
import {
  CONTRACT_CATEGORY_MASTER_CATEGORY_CODE,
  type ContractSortField,
  type ContractSummary,
} from "@/modules/contract/types";
import type { CreateContractInput, UpdateContractInput } from "@/modules/contract/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";

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

export const contractService = {
  // 契約の一覧を、指定されたページの分だけ取得する。
  async list(
    page: number,
    pageSize: number,
    sort: ContractSortField = "title",
    order: SortOrder = "asc",
  ): Promise<Paginated<ContractSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [contracts, total] = await contractRepository.listAndCount(skip, take, sort, order);
    const ids = contracts.map((c) => c.categoryMasterId).filter((id): id is number => id !== null);
    const labelById = await masterService.resolveMasterContents(ids);
    return paginated(
      contracts.map((c) => toSummary(c, labelById)),
      total,
      { page, pageSize },
    );
  },

  // 契約を新規登録し、画面に表示する形にして返す。
  // 登録直後の結果には契約先の名前が含まれないため、改めて取得し直している。
  async create(input: CreateContractInput): Promise<ContractSummary> {
    await assertCategoryValid(input.categoryMasterId);
    const contract = await contractRepository.create({
      party: { connect: { id: input.partyId } },
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
      categoryMasterId: input.categoryMasterId ?? null,
    });
    const withParty = await contractRepository.findById(contract.id);
    if (!withParty) throw Errors.notFound("契約が見つかりません");
    const labelById = await masterService.resolveMasterContents(
      withParty.categoryMasterId !== null ? [withParty.categoryMasterId] : [],
    );
    return toSummary(withParty, labelById);
  },

  // 契約を更新し、更新後の内容を画面に表示する形にして返す。
  // 契約先の変更はここでは扱わない（登録時に決めた契約先を変えられないようにするため）。
  async update(input: UpdateContractInput): Promise<ContractSummary> {
    const existing = await contractRepository.findById(input.id);
    if (!existing) throw Errors.notFound("契約が見つかりません");
    await assertCategoryValid(input.categoryMasterId);
    await contractRepository.update(input.id, {
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
      categoryMasterId: input.categoryMasterId ?? null,
    });
    const withParty = await contractRepository.findById(input.id);
    if (!withParty) throw Errors.notFound("契約が見つかりません");
    const labelById = await masterService.resolveMasterContents(
      withParty.categoryMasterId !== null ? [withParty.categoryMasterId] : [],
    );
    return toSummary(withParty, labelById);
  },

  // 契約を削除する。
  async remove(id: string): Promise<void> {
    await contractRepository.remove(id);
  },
};
