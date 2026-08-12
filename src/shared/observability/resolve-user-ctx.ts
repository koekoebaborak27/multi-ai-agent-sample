/**
 * 記録に添える「誰が操作したか」を調べる。
 *
 * ログインの仕組みを直接読み込まず、必要になった時点で読み込んでいる。
 * この記録の仕組みは、画面からの操作だけでなく、ログインという考え方が無い
 * 定期実行の処理や、外部連携用の窓口（認証ガードの外にある `/api`）からも使うため、
 * 常に読み込む形にすると動かせなくなるから。
 * 利用者が分からない場合は、何も付けずに空のまま返す。
 */
export async function resolveUserCtx(): Promise<{ userId?: string; role?: string }> {
  try {
    const mod = await import("@/shared/auth/session");
    const user = await mod.getCurrentUser();
    return user ? { userId: user.id, role: user.role } : {};
  } catch {
    return {};
  }
}
