import { masterService } from "@/modules/master";
import { partyRepository } from "@/modules/party/repository";
import {
  PARTY_COMPANY_TYPE_CATEGORY_CODE,
  type PartyDetail,
  type PartySearchCriteria,
  type PartySortField,
  type PartySummary,
} from "@/modules/party/types";
import type {
  CreatePartyInput,
  DeletePartyInput,
  UpdatePartyInput,
} from "@/modules/party/validation";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { AppError } from "@/shared/errors/app-error";
import { Prisma, type Party } from "@prisma/client";

// マスタから解決できなかった（未選択・削除済みなどで内容を取得できなかった）場合の表示文言。
// docs/specs/02_basic-design/master/01_データベース.md §01.1.4 の規約に合わせる。
const UNSET_LABEL = "未設定";

// 対象の契約先が見つからないときのエラー（すでに削除された、URLの指定が誤っている、など）。
// マスタ機能のMASTER_NOT_FOUND等と異なりErrorsファクトリを使わず直接組み立てる（§00.6）。
function partyNotFound(id: string): AppError {
  return new AppError("PARTY_NOT_FOUND", 404, "対象の契約先が見つかりません", { id });
}

// 契約先の更新・削除画面を開いてから保存するまでの間に、他の利用者が先に更新・削除していたときのエラー
function partyConcurrentUpdate(id: string): AppError {
  return new AppError(
    "PARTY_CONCURRENT_UPDATE",
    409,
    "ほかの利用者によって更新されています。最新の内容を確認してください",
    { id },
  );
}

// 削除対象の契約先に紐づく契約が1件以上存在するときのエラー（§14.1）
function partyHasContracts(id: string, contractCount: number): AppError {
  return new AppError(
    "PARTY_HAS_CONTRACTS",
    409,
    `この契約先には${contractCount}件の契約が登録されているため削除できません。先に契約を削除してください。`,
    { id, contractCount },
  );
}

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
  // 契約先の一覧を、検索条件に従って指定されたページの分だけ取得する。
  async list(
    criteria: PartySearchCriteria,
    page: number,
    pageSize: number,
    sort: PartySortField = "name",
    order: SortOrder = "asc",
  ): Promise<Paginated<PartySummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const keyword = criteria.keyword?.trim() || undefined;
    const [parties, total] = await partyRepository.listAndCount(
      { keyword, companyTypeMasterId: criteria.companyTypeMasterId },
      skip,
      take,
      sort,
      order,
    );
    const ids = parties.map((p) => p.companyTypeMasterId).filter((id): id is number => id !== null);
    const labelById = await masterService.resolveMasterContents(ids);
    return paginated(
      parties.map((p) => toSummary(p, labelById)),
      total,
      { page, pageSize },
    );
  },

  // 詳細画面に表示する契約先1件を取得する。
  // 見つからない場合はエラーにせず「無し」を返し、その後どう扱うか（404画面を出すなど）は呼び出し側に任せる。
  async findDetail(id: string): Promise<PartyDetail | null> {
    const party = await partyRepository.findById(id);
    if (!party) return null;
    const labelById = await masterService.resolveMasterContents(
      party.companyTypeMasterId !== null ? [party.companyTypeMasterId] : [],
    );
    return {
      ...toSummary(party, labelById),
      createdAt: party.createdAt,
      createdBy: party.createdBy,
      updatedAt: party.updatedAt,
      updatedBy: party.updatedBy,
    };
  },

  // 確認画面を出す前に、選択された契約先分類が有効かどうかだけを確認したい場面があるため、
  // 上で定義した確認用の関数を、そのまま外からも呼べるように公開している（マスタ機能と同じ考え方）。
  assertCompanyTypeValid,

  // 契約先を新規登録する。分類・連絡先は任意入力なので、未入力なら空として登録する。
  // createdBy・updatedByには登録を実行した利用者のユーザーIDを設定する。
  async create(input: CreatePartyInput, userId: string): Promise<PartySummary> {
    await assertCompanyTypeValid(input.companyTypeMasterId);
    const party = await partyRepository.create({
      name: input.name,
      companyTypeMasterId: input.companyTypeMasterId ?? null,
      contactInfo: input.contactInfo ?? null,
      createdBy: userId,
      updatedBy: userId,
    });
    const labelById = await masterService.resolveMasterContents(
      party.companyTypeMasterId !== null ? [party.companyTypeMasterId] : [],
    );
    return toSummary(party, labelById);
  },

  // 契約先を更新する。
  // 更新画面を開いてから保存するまでの間に、他の利用者が先に更新・削除していないかを、
  // 保存前の確認と、条件付きの更新（updateIfUnchanged）の2段階で確かめる（マスタ機能と同じ方式。§13.2）。
  async update(input: UpdatePartyInput, userId: string): Promise<void> {
    const existing = await partyRepository.findById(input.id);
    if (!existing) throw partyNotFound(input.id);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw partyConcurrentUpdate(input.id);
    }

    await assertCompanyTypeValid(input.companyTypeMasterId);

    const updated = await partyRepository.updateIfUnchanged(input.id, input.updatedAt, {
      name: input.name,
      companyTypeMasterId: input.companyTypeMasterId ?? null,
      contactInfo: input.contactInfo ?? null,
      updatedBy: userId,
    });
    if (!updated) {
      // 1件も更新されなかった場合、対象が削除されたのか、他の利用者に先に更新されたのかが分からない。
      // どちらなのかを判断して適切なメッセージを出すため、もう一度取得して確かめる。
      const current = await partyRepository.findById(input.id);
      if (!current) throw partyNotFound(input.id);
      throw partyConcurrentUpdate(input.id);
    }
  },

  // 契約先を削除する。物理削除であり、元に戻せない。
  // 検証の順序は権限（呼び出し元のServer Actionで確認済み）→存在→同時更新→紐づく契約の件数の順とする（§14.3）。
  async remove(input: DeletePartyInput): Promise<{ name: string; companyTypeLabel: string }> {
    const existing = await partyRepository.findById(input.id);
    if (!existing) throw partyNotFound(input.id);

    if (existing.updatedAt.getTime() !== input.updatedAt.getTime()) {
      throw partyConcurrentUpdate(input.id);
    }

    const contractCount = await partyRepository.countContracts(input.id);
    if (contractCount > 0) throw partyHasContracts(input.id, contractCount);

    try {
      const deleted = await partyRepository.deleteIfUnchanged(input.id, input.updatedAt);
      if (!deleted) {
        // 1件も削除されなかった場合、対象がすでに削除されたのか、他の利用者に先に更新されたのかが分からない。
        const current = await partyRepository.findById(input.id);
        if (!current) throw partyNotFound(input.id);
        throw partyConcurrentUpdate(input.id);
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        // 件数確認の直後に、他の利用者が同じ契約先へ契約を登録したことを意味する
        const current = await partyRepository.countContracts(input.id);
        throw partyHasContracts(input.id, current);
      }
      throw error;
    }

    const labelById = await masterService.resolveMasterContents(
      existing.companyTypeMasterId !== null ? [existing.companyTypeMasterId] : [],
    );
    return {
      name: existing.name,
      companyTypeLabel: toSummary(existing, labelById).companyTypeLabel,
    };
  },
};
