import { contractRepository, type ContractWithParty } from "@/modules/contract/repository";
import type { ContractSummary } from "@/modules/contract/types";
import type { CreateContractInput, UpdateContractInput } from "@/modules/contract/validation";
import { toSkipTake, paginated, type Paginated } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";

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
  async list(page: number, pageSize: number): Promise<Paginated<ContractSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [contracts, total] = await contractRepository.listAndCount(skip, take);
    return paginated(contracts.map(toSummary), total, { page, pageSize });
  },

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

  async remove(id: string): Promise<void> {
    await contractRepository.remove(id);
  },
};
