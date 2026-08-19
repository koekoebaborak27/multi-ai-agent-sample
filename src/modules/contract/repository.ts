import { prisma } from "@/shared/db/prisma";
import type { ContractSortField, ContractStatus } from "@/modules/contract/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Contract, Party, Prisma } from "@prisma/client";

/** 契約に、その契約先の情報を合わせて取得したときの形 */
export type ContractWithParty = Contract & { party: Party };

/** 契約一覧の絞り込み条件。指定しなかった項目では絞り込まない */
export interface ContractListFilters {
  partyId?: string;
  status?: ContractStatus;
  categoryMasterId?: number;
}

// 契約一覧の絞り込み条件から、Prismaのwhere句を組み立てる
function buildContractWhere(filters: ContractListFilters): Prisma.ContractWhereInput {
  return {
    ...(filters.partyId === undefined ? {} : { partyId: filters.partyId }),
    ...(filters.status === undefined ? {} : { status: filters.status }),
    ...(filters.categoryMasterId === undefined
      ? {}
      : { categoryMasterId: filters.categoryMasterId }),
  };
}

export const contractRepository = {
  // 契約の一覧を、検索条件・ページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listAndCount(
    filters: ContractListFilters,
    skip: number,
    take: number,
    sort: ContractSortField,
    order: SortOrder,
  ): Promise<[ContractWithParty[], number]> {
    const where = buildContractWhere(filters);
    // 契約先名だけは契約テーブルではなく契約先テーブルの項目なので、並び替えの指定方法が異なる
    const orderBy: Prisma.ContractOrderByWithRelationInput =
      sort === "partyName" ? { party: { name: order } } : { [sort]: order };
    return Promise.all([
      prisma.contract.findMany({
        where,
        include: { party: true },
        // 並び替えの基準が同じ行どうしの順番が実行のたびに変わらないよう、識別子も並び順に加える
        orderBy: [orderBy, { id: "asc" }],
        skip,
        take,
      }),
      prisma.contract.count({ where }),
    ]);
  },

  // 契約1件を、契約先の情報も合わせて取得する
  findById(id: string): Promise<ContractWithParty | null> {
    return prisma.contract.findUnique({ where: { id }, include: { party: true } });
  },

  // 指定した契約先が現在も存在するかを確認し、存在すれば名称を返す。存在しなければnull。
  // 契約の登録・更新の確認時に、選択された契約先が現在も有効かを確かめるために使う（§21.1.2）。
  // 契約モジュールからpartyモジュールのリポジトリ・サービスへは依存せず、契約先の存在確認は
  // partyモジュールが契約の件数を数えるとき（countContracts）と対称的に、この場所でPartyテーブルを
  // 直接参照して行う。
  async findPartyName(partyId: string): Promise<string | null> {
    const party = await prisma.party.findUnique({ where: { id: partyId }, select: { name: true } });
    return party?.name ?? null;
  },

  // 契約を1件登録する
  create(data: Prisma.ContractCreateInput): Promise<Contract> {
    return prisma.contract.create({ data });
  },

  // 契約を更新する。ただし「最終更新日時がexpectedUpdatedAtのままである」ときだけ更新する。
  // 更新画面を開いてから保存するまでの間に他の利用者が更新していた場合、この条件に合わなくなるので
  // 上書きされない。更新できたかどうかをtrue/falseで返す（契約先・マスタ機能と同じ方式）。
  async updateIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: {
      title: string;
      startDate: Date | null;
      endDate: Date | null;
      status: ContractStatus;
      categoryMasterId: number | null;
      updatedBy: string;
    },
  ): Promise<boolean> {
    const result = await prisma.contract.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data,
    });
    return result.count === 1;
  },

  // 契約を1件削除する
  async remove(id: string): Promise<void> {
    await prisma.contract.delete({ where: { id } });
  },
};
