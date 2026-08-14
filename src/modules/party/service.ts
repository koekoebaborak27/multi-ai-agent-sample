import { partyRepository } from "@/modules/party/repository";
import type { PartySortField, PartySummary } from "@/modules/party/types";
import type { CreatePartyInput, UpdatePartyInput } from "@/modules/party/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";
import type { Party } from "@prisma/client";

/** データベースから取得した契約先を、画面で使う項目だけに絞った形へ詰め替える */
function toSummary(p: Party): PartySummary {
  return { id: p.id, name: p.name, kind: p.kind, contactInfo: p.contactInfo };
}

export const partyService = {
  // 契約先の一覧を、指定されたページの分だけ取得する。
  async list(
    page: number,
    pageSize: number,
    sort: PartySortField = "name",
    order: SortOrder = "asc",
  ): Promise<Paginated<PartySummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [parties, total] = await partyRepository.listAndCount(skip, take, sort, order);
    return paginated(parties.map(toSummary), total, { page, pageSize });
  },

  // 契約先を新規登録する。種別・連絡先は任意入力なので、未入力なら空として登録する。
  async create(input: CreatePartyInput): Promise<PartySummary> {
    const party = await partyRepository.create({
      name: input.name,
      kind: input.kind ?? null,
      contactInfo: input.contactInfo ?? null,
    });
    return toSummary(party);
  },

  // 契約先を更新する。存在しない契約先を指定された場合は、更新せずエラーにする。
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

  // 契約先を削除する。
  async remove(id: string): Promise<void> {
    await partyRepository.remove(id);
  },
};
