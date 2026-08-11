import { prisma } from "@/shared/db/prisma";
import type { PartySortField } from "@/modules/party/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Party, Prisma } from "@prisma/client";

export const partyRepository = {
  // 契約先の一覧をページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listAndCount(
    skip: number,
    take: number,
    sort: PartySortField,
    order: SortOrder,
  ): Promise<[Party[], number]> {
    const orderBy: Prisma.PartyOrderByWithRelationInput = { [sort]: order };
    return Promise.all([
      // 並び替えの基準が同じ行どうしの順番が実行のたびに変わらないよう、識別子も並び順に加える
      prisma.party.findMany({ orderBy: [orderBy, { id: "asc" }], skip, take }),
      prisma.party.count(),
    ]);
  },

  // 契約先1件を取得する
  findById(id: string): Promise<Party | null> {
    return prisma.party.findUnique({ where: { id } });
  },

  // 契約先を1件登録する
  create(data: Prisma.PartyCreateInput): Promise<Party> {
    return prisma.party.create({ data });
  },

  // 契約先を1件更新する
  update(id: string, data: Prisma.PartyUpdateInput): Promise<Party> {
    return prisma.party.update({ where: { id }, data });
  },

  // 契約先を1件削除する
  async remove(id: string): Promise<void> {
    await prisma.party.delete({ where: { id } });
  },
};
