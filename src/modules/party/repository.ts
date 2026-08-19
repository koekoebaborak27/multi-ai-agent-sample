import { prisma } from "@/shared/db/prisma";
import type { PartySortField } from "@/modules/party/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Party, Prisma } from "@prisma/client";

/** 契約先一覧の絞り込み条件。指定しなかった項目では絞り込まない */
export interface PartyListFilters {
  keyword?: string;
  companyTypeMasterId?: number;
}

// 契約先一覧の絞り込み条件から、Prismaのwhere句を組み立てる
function buildPartyWhere(filters: PartyListFilters): Prisma.PartyWhereInput {
  return {
    // 分類が指定されていない（「すべて」）ときは、絞り込み条件を付けずすべての分類を対象にする
    ...(filters.companyTypeMasterId === undefined
      ? {}
      : { companyTypeMasterId: filters.companyTypeMasterId }),
    // 名称は大文字・小文字を区別しない部分一致検索とする（マスタ検索一覧と同じ方式）
    ...(filters.keyword ? { name: { contains: filters.keyword, mode: "insensitive" } } : {}),
  };
}

export const partyRepository = {
  // 契約先の一覧を、検索条件・ページ・並び順に従って取得し、あわせて全体の件数も返す。
  async listAndCount(
    filters: PartyListFilters,
    skip: number,
    take: number,
    sort: PartySortField,
    order: SortOrder,
  ): Promise<[Party[], number]> {
    const where = buildPartyWhere(filters);
    const orderBy: Prisma.PartyOrderByWithRelationInput = { [sort]: order };
    return Promise.all([
      // 並び替えの基準が同じ行どうしの順番が実行のたびに変わらないよう、識別子も並び順に加える
      prisma.party.findMany({ where, orderBy: [orderBy, { id: "asc" }], skip, take }),
      prisma.party.count({ where }),
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

  // 契約先を更新する。ただし「最終更新日時がexpectedUpdatedAtのままである」ときだけ更新する。
  // 更新画面を開いてから保存するまでの間に他の利用者が更新していた場合、この条件に合わなくなるので
  // 上書きされない。更新できたかどうかをtrue/falseで返す（マスタ機能と同じ方式）。
  async updateIfUnchanged(
    id: string,
    expectedUpdatedAt: Date,
    data: {
      name: string;
      companyTypeMasterId: number | null;
      contactInfo: string | null;
      updatedBy: string;
    },
  ): Promise<boolean> {
    const result = await prisma.party.updateMany({
      where: { id, updatedAt: expectedUpdatedAt },
      data,
    });
    return result.count === 1;
  },

  // 指定した契約先に紐づく契約の件数を数える。削除条件（紐づく契約が0件であること）の判定に使う（§14.1）。
  countContracts(id: string): Promise<number> {
    return prisma.contract.count({ where: { partyId: id } });
  },

  // 契約先を削除する。物理削除であり、更新と同じく最終更新日時が変わっていないときだけ削除する。
  // 紐づく契約が残っている場合はContract.partyIdの外部キー制約により失敗する（呼び出し元で処理する）。
  async deleteIfUnchanged(id: string, expectedUpdatedAt: Date): Promise<boolean> {
    const result = await prisma.party.deleteMany({
      where: { id, updatedAt: expectedUpdatedAt },
    });
    return result.count === 1;
  },
};
