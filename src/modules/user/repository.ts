import { prisma } from "@/shared/db/prisma";
import type { Prisma, User } from "@prisma/client";

export const userRepository = {
  async listAndCount(skip: number, take: number): Promise<[User[], number]> {
    return Promise.all([
      prisma.user.findMany({
        where: { deleted: false },
        orderBy: { id: "asc" },
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
