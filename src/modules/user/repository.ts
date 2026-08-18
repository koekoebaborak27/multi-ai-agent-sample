import { prisma } from "@/shared/db/prisma";
import type { UserSortField } from "@/modules/user/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Prisma, User } from "@prisma/client";

export const userRepository = {
  // 利用者の一覧をページ・並び順に従って取得し、あわせて全体の件数も返す。
  // 削除済みの印が付いた利用者は、一覧にも件数にも含めない。
  async listAndCount(
    skip: number,
    take: number,
    sort: UserSortField,
    order: SortOrder,
  ): Promise<[User[], number]> {
    // 「ログイン方法」と「状態」は画面上の表示であり、対応する項目がデータベースには無い。
    // そのため、表示のもとになっている複数の項目を組み合わせて並び替える。
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      sort === "authMethod"
        ? [{ passwordHash: order }, { externalId: order }]
        : sort === "status"
          ? [{ lockedAt: order }, { mustChangePassword: order }]
          : [{ [sort === "userId" ? "id" : sort]: order }];
    // ログインID順以外は同じ値の行が出るため、順番が毎回変わらないようログインIDも並び順に加える
    if (sort !== "userId") orderBy.push({ id: "asc" });

    return Promise.all([
      prisma.user.findMany({
        where: { deleted: false },
        orderBy,
        skip,
        take,
      }),
      prisma.user.count({ where: { deleted: false } }),
    ]);
  },

  // 利用者1件を取得する
  findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  // 複数の利用者IDから、表示名の解決に必要な項目だけをまとめて取得する。
  // 1件ずつ問い合わせる（N+1）のを避けるため、他の一覧（マスタ情報Excel取得の実行者名など）で使う。
  // 退会済みでも過去の記録として名前を出したいため、deletedでは絞り込まない。
  findManyByIds(ids: string[]): Promise<Pick<User, "id" | "displayName">[]> {
    return prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, displayName: true },
    });
  },

  // 利用者を1件登録する
  create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  // 利用者を1件更新する
  update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data });
  },

  // 利用者に削除済みの印を付ける。データそのものは残すため、後から記録をたどれる。
  async softDelete(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { deleted: true } });
  },
};
