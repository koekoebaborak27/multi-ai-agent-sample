import { partyRepository } from "@/modules/party/repository";
import type { PartySummary } from "@/modules/party/types";
import type { CreatePartyInput, UpdatePartyInput } from "@/modules/party/validation";
import { toSkipTake, paginated, type Paginated } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";
import type { Party } from "@prisma/client";

function toSummary(p: Party): PartySummary {
  return { id: p.id, name: p.name, kind: p.kind, contactInfo: p.contactInfo };
}

export const partyService = {
  async list(page: number, pageSize: number): Promise<Paginated<PartySummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [parties, total] = await partyRepository.listAndCount(skip, take);
    return paginated(parties.map(toSummary), total, { page, pageSize });
  },

  async create(input: CreatePartyInput): Promise<PartySummary> {
    const party = await partyRepository.create({
      name: input.name,
      kind: input.kind ?? null,
      contactInfo: input.contactInfo ?? null,
    });
    return toSummary(party);
  },

  async update(input: UpdatePartyInput): Promise<PartySummary> {
    const existing = await partyRepository.findById(input.id);
    if (!existing) throw Errors.notFound("契約先が見つかりません");
    const party = await partyRepository.update(input.id, {
      name: input.name,
      kind: input.kind ?? null,
      contactInfo: input.contactInfo ?? null,
    });
    return toSummary(party);
  },

  async remove(id: string): Promise<void> {
    await partyRepository.remove(id);
  },
};
