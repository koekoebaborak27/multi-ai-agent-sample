import { userRepository } from "@/modules/user/repository";
import type { UserSummary } from "@/modules/user/types";
import type { CreateUserInput, UpdateUserInput } from "@/modules/user/validation";
import { authService } from "@/modules/auth/service";
import { toSkipTake, paginated, type Paginated } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";
import { isRole, type Role } from "@/shared/constants/roles";
import type { User } from "@prisma/client";

function toSummary(u: User): UserSummary {
  return {
    userId: u.id,
    role: (isRole(u.role) ? u.role : "VIEWER") as Role,
    displayName: u.displayName,
    email: u.email,
    locked: u.lockedAt !== null,
    mustChangePassword: u.mustChangePassword,
    authMethod: u.passwordHash ? "credentials" : u.externalId ? "entra" : "none",
  };
}

export const userService = {
  async list(page: number, pageSize: number): Promise<Paginated<UserSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [users, total] = await userRepository.listAndCount(skip, take);
    return paginated(users.map(toSummary), total, { page, pageSize });
  },

  async create(input: CreateUserInput): Promise<UserSummary> {
    const existing = await userRepository.findById(input.userId);
    if (existing) throw Errors.conflict("そのユーザーIDは既に存在します", { userId: input.userId });

    const passwordHash =
      input.password && input.password.length > 0
        ? await authService.hashPassword(input.password)
        : null;

    const user = await userRepository.create({
      id: input.userId,
      role: input.role,
      displayName: input.displayName ?? null,
      email: input.email && input.email.length > 0 ? input.email : null,
      passwordHash,
      mustChangePassword: passwordHash !== null, // 初期PW付与時は変更を強制
    });
    return toSummary(user);
  },

  async update(input: UpdateUserInput): Promise<UserSummary> {
    const existing = await userRepository.findById(input.userId);
    if (!existing) throw Errors.notFound("ユーザーが見つかりません");
    const user = await userRepository.update(input.userId, {
      role: input.role,
      displayName: input.displayName ?? null,
    });
    return toSummary(user);
  },

  async remove(userId: string): Promise<void> {
    await userRepository.softDelete(userId);
  },
};
