import { masterService } from "@/modules/master";
import { partyRepository } from "@/modules/party/repository";
import {
  PARTY_COMPANY_TYPE_CATEGORY_CODE,
  type PartySortField,
  type PartySummary,
} from "@/modules/party/types";
import type { CreatePartyInput, UpdatePartyInput } from "@/modules/party/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";
import type { Party } from "@prisma/client";

// マスタから解決できなかった（未選択・削除済みなどで内容を取得できなかった）場合の表示文言。
// docs/specs/02_basic-design/master/01_データベース.md §01.1.4 の規約に合わせる。
const UNSET_LABEL = "未設定";

/** データベースから取得した契約先を、画面で使う項目だけに絞った形へ詰め替える */
function toSummary(p: Party, labelById: Map<number, string>): PartySummary {
  return {
    id: p.id,
    name: p.name,
    companyTypeMasterId: p.companyTypeMasterId,
    companyTypeLabel:
      (p.companyTypeMasterId !== null ? labelById.get(p.companyTypeMasterId) : undefined) ??
      UNSET_LABEL,
    contactInfo: p.contactInfo,
  };
}

// 契約先分類として選ばれたマスタが、実際に契約先分類（CONTRACT_COMPANY_TYPE）配下のものかを
// 確認する。未選択（undefined）の場合は確認不要。
async function assertCompanyTypeValid(companyTypeMasterId: number | undefined): Promise<void> {
  if (companyTypeMasterId === undefined) return;
  await masterService.assertMasterInCategoryCode(
    companyTypeMasterId,
    PARTY_COMPANY_TYPE_CATEGORY_CODE,
  );
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
    const ids = parties.map((p) => p.companyTypeMasterId).filter((id): id is number => id !== null);
    const labelById = await masterService.resolveMasterContents(ids);
    return paginated(
      parties.map((p) => toSummary(p, labelById)),
      total,
      { page, pageSize },
    );
  },

  // 契約先を新規登録する。分類・連絡先は任意入力なので、未入力なら空として登録する。
  async create(input: CreatePartyInput): Promise<PartySummary> {
    await assertCompanyTypeValid(input.companyTypeMasterId);
    const party = await partyRepository.create({
      name: input.name,
      companyTypeMasterId: input.companyTypeMasterId ?? null,
      contactInfo: input.contactInfo ?? null,
    });
    const labelById = await masterService.resolveMasterContents(
      party.companyTypeMasterId !== null ? [party.companyTypeMasterId] : [],
    );
    return toSummary(party, labelById);
  },

  // 契約先を更新する。存在しない契約先を指定された場合は、更新せずエラーにする。
  async update(input: UpdatePartyInput): Promise<PartySummary> {
    const existing = await partyRepository.findById(input.id);
    if (!existing) throw Errors.notFound("契約先が見つかりません");
    await assertCompanyTypeValid(input.companyTypeMasterId);
    const party = await partyRepository.update(input.id, {
      name: input.name,
      companyTypeMasterId: input.companyTypeMasterId ?? null,
      contactInfo: input.contactInfo ?? null,
    });
    const labelById = await masterService.resolveMasterContents(
      party.companyTypeMasterId !== null ? [party.companyTypeMasterId] : [],
    );
    return toSummary(party, labelById);
  },

  // 契約先を削除する。
  async remove(id: string): Promise<void> {
    await partyRepository.remove(id);
  },
};
