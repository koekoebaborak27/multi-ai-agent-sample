import { prisma } from "@/shared/db/prisma";
import type { UserSortField } from "@/modules/user/types";
import type { SortOrder } from "@/shared/api/pagination";
import type { Prisma, User } from "@prisma/client";

export const userRepository = {
  async listAndCount(
    skip: number,
    take: number,
    sort: UserSortField,
    order: SortOrder,
  ): Promise<[User[], number]> {
    const orderBy: Prisma.UserOrderByWithRelationInput[] =
      sort === "authMethod"
        ? [{ passwordHash: order }, { externalId: order }]
        : sort === "status"
          ? [{ lockedAt: order }, { mustChangePassword: order }]
          : [{ [sort === "userId" ? "id" : sort]: order }];
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

  findById(userId: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id: userId } });
  },

  create(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  update(userId: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id: userId }, data });
  },

  async softDelete(userId: string): Promise<void> {
    await prisma.user.update({ where: { id: userId }, data: { deleted: true } });
  },
};
