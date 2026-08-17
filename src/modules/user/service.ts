import { userRepository } from "@/modules/user/repository";
import type { UserSortField, UserSummary } from "@/modules/user/types";
import type { CreateUserInput, UpdateUserInput } from "@/modules/user/validation";
import { authService } from "@/modules/auth/service";
import { toSkipTake, paginated, type Paginated, type SortOrder } from "@/shared/api/pagination";
import { Errors } from "@/shared/errors/app-error";
import { isRole, type Role } from "@/shared/constants/roles";
import type { User } from "@prisma/client";

/**
 * データベースの利用者情報を、画面に表示する形へ詰め替える。
 * パスワードは画面に渡さず、代わりに「どの方法でログインできるか」だけを判定して持たせる。
 * 役割の値が想定外だった場合は、いちばん権限の弱い閲覧のみの役割として扱う。
 */
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
  // 利用者の一覧を、指定されたページの分だけ取得する。
  async list(
    page: number,
    pageSize: number,
    sort: UserSortField = "userId",
    order: SortOrder = "asc",
  ): Promise<Paginated<UserSummary>> {
    const { skip, take } = toSkipTake({ page, pageSize });
    const [users, total] = await userRepository.listAndCount(skip, take, sort, order);
    return paginated(users.map(toSummary), total, { page, pageSize });
  },

  // 利用者を新規登録する。
  // 初期パスワードは任意で、入力しなかった場合は Microsoft アカウントでのログイン専用となる。
  async create(input: CreateUserInput): Promise<UserSummary> {
    const existing = await userRepository.findById(input.userId);
    if (existing) throw Errors.conflict("そのユーザーIDは既に存在します", { userId: input.userId });

    // パスワードはそのまま保存せず、元に戻せない形に変換してから保存する
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
      // 管理者が決めた初期パスワードを本人以外が知っている状態なので、初回ログイン時に変更させる
      mustChangePassword: passwordHash !== null,
    });
    return toSummary(user);
  },

  // 利用者の表示名と役割を更新する。
  // パスワードとログインIDはここでは変更できない（パスワードは本人が変更する）。
  async update(input: UpdateUserInput): Promise<UserSummary> {
    const existing = await userRepository.findById(input.userId);
    if (!existing) throw Errors.notFound("ユーザーが見つかりません");
    const user = await userRepository.update(input.userId, {
      role: input.role,
      displayName: input.displayName ?? null,
    });
    return toSummary(user);
  },

  // 利用者を削除する。
  // データそのものは消さず、削除済みの印を付けるだけにしている
  // （その利用者が登録・更新した記録が残っているため、たどれなくならないようにする）。
  async remove(userId: string): Promise<void> {
    await userRepository.softDelete(userId);
  },

  // 複数の利用者IDから「ID→表示名」の対応表を作る。
  // 表示名が未設定、または利用者が見つからない（削除済み等）場合は、IDそのものを表示名として使う。
  async resolveDisplayNames(userIds: string[]): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(userIds)];
    if (uniqueIds.length === 0) return new Map();
    const users = await userRepository.findManyByIds(uniqueIds);
    const displayNameById = new Map(users.map((u) => [u.id, u.displayName]));
    return new Map(uniqueIds.map((id) => [id, displayNameById.get(id) || id]));
  },
};
