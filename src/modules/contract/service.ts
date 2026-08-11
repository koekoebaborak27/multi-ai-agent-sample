import { contractRepository, type ContractWithParty } from "@/modules/contract/repository";
import type { ContractSortField, ContractSummary } from "@/modules/contract/types";
import type { CreateContractInput, UpdateContractInput } from "@/modules/contract/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";

/** データベースから取得した契約を画面用の形に詰め替える。契約先名は別テーブルにあるため同じ階層へ移す */
function toSummary(c: ContractWithParty): ContractSummary {
  return {
    id: c.id,
    partyId: c.partyId,
    partyName: c.party.name,
    title: c.title,
    startDate: c.startDate,
    endDate: c.endDate,
    status: c.status,
  };
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
    return paginated(contracts.map(toSummary), total, { page, pageSize });
  },

  // 契約を新規登録し、画面に表示する形にして返す。
  // 登録直後の結果には契約先の名前が含まれないため、改めて取得し直している。
  async create(input: CreateContractInput): Promise<ContractSummary> {
    const contract = await contractRepository.create({
      party: { connect: { id: input.partyId } },
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
    });
    const withParty = await contractRepository.findById(contract.id);
    if (!withParty) throw Errors.notFound("契約が見つかりません");
    return toSummary(withParty);
  },

  // 契約を更新し、更新後の内容を画面に表示する形にして返す。
  // 契約先の変更はここでは扱わない（登録時に決めた契約先を変えられないようにするため）。
  async update(input: UpdateContractInput): Promise<ContractSummary> {
    const existing = await contractRepository.findById(input.id);
    if (!existing) throw Errors.notFound("契約が見つかりません");
    await contractRepository.update(input.id, {
      title: input.title,
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      status: input.status,
    });
    const withParty = await contractRepository.findById(input.id);
    if (!withParty) throw Errors.notFound("契約が見つかりません");
    return toSummary(withParty);
  },

  // 契約を削除する。
  async remove(id: string): Promise<void> {
    await contractRepository.remove(id);
  },
};
