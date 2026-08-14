import { prisma } from "@/shared/db/prisma";
import type { ContractSortField } from "@/modules/contract/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Contract, Party, Prisma } from "@prisma/client";

/** 契約に、その契約先の情報を合わせて取得したときの形 */
export type ContractWithParty = Contract & { party: Party };

export const contractRepository = {
  // 契約の一覧をページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listAndCount(
    skip: number,
    take: number,
    sort: ContractSortField,
    order: SortOrder,
  ): Promise<[ContractWithParty[], number]> {
    // 契約先名だけは契約テーブルではなく契約先テーブルの項目なので、並び替えの指定方法が異なる
    const orderBy: Prisma.ContractOrderByWithRelationInput =
      sort === "partyName" ? { party: { name: order } } : { [sort]: order };
    return Promise.all([
      prisma.contract.findMany({
        include: { party: true },
        // 並び替えの基準が同じ行どうしの順番が実行のたびに変わらないよう、識別子も並び順に加える
        orderBy: [orderBy, { id: "asc" }],
        skip,
        take,
      }),
      prisma.contract.count(),
    ]);
  },

  // 契約1件を、契約先の情報も合わせて取得する
  findById(id: string): Promise<ContractWithParty | null> {
    return prisma.contract.findUnique({ where: { id }, include: { party: true } });
  },

  // 契約を1件登録する
  create(data: Prisma.ContractCreateInput): Promise<Contract> {
    return prisma.contract.create({ data });
  },

  // 契約を1件更新する
  update(id: string, data: Prisma.ContractUpdateInput): Promise<Contract> {
    return prisma.contract.update({ where: { id }, data });
  },

  // 契約を1件削除する
  async remove(id: string): Promise<void> {
    await prisma.contract.delete({ where: { id } });
  },
};
