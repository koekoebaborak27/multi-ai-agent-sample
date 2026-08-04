/**
 * 対象: auth/route-guard decideRedirect
 * 目的: proxy（middleware）のリダイレクト判定を担保する。
 *       とくに Server Action の POST を誘導しないこと（ログイン直後の無限ループ防止）を押さえる。
 */
import { describe, expect, it } from "vitest";
import {
  decideRedirect,
  PASSWORD_CHANGE_PATH,
  type RouteGuardInput,
} from "@/modules/auth/route-guard";
import { ROLES } from "@/shared/constants/roles";

/** 既定は「ログイン済み ADMIN が画面遷移(GET)でトップへ来た」状態。差分だけ override する */
const input = (o: Partial<RouteGuardInput> = {}): RouteGuardInput => ({
  path: "/",
  isLoggedIn: true,
  isServerAction: false,
  mustChangePassword: false,
  role: ROLES.ADMIN,
  ...o,
});

describe("auth/route-guard decideRedirect", () => {
  describe("未ログインのとき", () => {
    it("/login はそのまま通す", () => {
      expect(decideRedirect(input({ isLoggedIn: false, role: null, path: "/login" }))).toBeNull();
    });

    it("/login 以外は /login へ誘導する", () => {
      expect(decideRedirect(input({ isLoggedIn: false, role: null, path: "/parties" }))).toBe(
        "/login",
      );
    });

    it("Server Action であっても /login へ誘導する（未認証を業務処理へ届かせないため）", () => {
      expect(
        decideRedirect(
          input({ isLoggedIn: false, role: null, path: "/parties", isServerAction: true }),
        ),
      ).toBe("/login");
    });
  });

  describe("ログイン済みで /login に来たとき", () => {
    it("画面遷移なら / へ誘導する", () => {
      expect(decideRedirect(input({ path: "/login" }))).toBe("/");
    });

    it("Server Action なら誘導しない", () => {
      expect(decideRedirect(input({ path: "/login", isServerAction: true }))).toBeNull();
    });
  });

  describe("初回パスワード変更が未了のとき", () => {
    it("画面遷移なら /settings/password へ誘導する", () => {
      expect(decideRedirect(input({ mustChangePassword: true }))).toBe(PASSWORD_CHANGE_PATH);
    });

    it("すでに /settings/password にいるなら誘導しない", () => {
      expect(
        decideRedirect(input({ mustChangePassword: true, path: PASSWORD_CHANGE_PATH })),
      ).toBeNull();
    });

    it("Server Action なら誘導しない（ログイン直後にリダイレクトが往復するのを防ぐ）", () => {
      expect(decideRedirect(input({ mustChangePassword: true, isServerAction: true }))).toBeNull();
    });
  });

  describe("/admin 配下に ADMIN 以外がアクセスしたとき", () => {
    it("/ へ戻す", () => {
      expect(decideRedirect(input({ path: "/admin/users", role: ROLES.VIEWER }))).toBe("/");
    });

    it("Server Action でも / へ戻す（認可は緩めない）", () => {
      expect(
        decideRedirect(input({ path: "/admin/users", role: ROLES.OPERATOR, isServerAction: true })),
      ).toBe("/");
    });

    it("ADMIN なら通す", () => {
      expect(decideRedirect(input({ path: "/admin/users", role: ROLES.ADMIN }))).toBeNull();
    });
  });

  describe("いずれの条件にも当たらないとき", () => {
    it("誘導せず null を返す", () => {
      expect(decideRedirect(input({ path: "/contracts" }))).toBeNull();
    });
  });
});
