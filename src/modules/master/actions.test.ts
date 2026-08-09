/**
 * 対象: master/actions マスタ分類の登録・更新
 * 目的: 書き込み権限、確認時の事前検査、実行時の登録・更新と詳細画面への遷移を担保する
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMasterCategoryAction,
  updateMasterCategoryAction,
  type MasterCategoryFormState,
} from "@/modules/master/actions";
import { masterService } from "@/modules/master/service";
import { getCurrentUser } from "@/shared/auth/session";
import { AppError } from "@/shared/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/master/service", () => ({
  masterService: {
    assertCategoryNameAvailable: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
  },
}));

vi.mock("@/shared/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/shared/observability/with-op", () => ({
  withOp: (_op: string, fn: unknown) => fn,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

const initialState: MasterCategoryFormState = { mode: "create", phase: "input" };
const updatedAt = "2026-08-09T00:00:00.000Z";

const updateInitialState: MasterCategoryFormState = {
  mode: "update",
  phase: "input",
  categoryId: 12,
  code: "0012",
  originalName: "契約種別",
  name: "契約種別",
  masterCount: 3,
  updatedAt,
};

function createFormData(name: string, intent: "confirm" | "execute"): FormData {
  const formData = new FormData();
  formData.set("name", name);
  formData.set("intent", intent);
  return formData;
}

function createUpdateFormData(name: string, intent: "confirm" | "execute"): FormData {
  const formData = createFormData(name, intent);
  formData.set("categoryId", "12");
  formData.set("updatedAt", updatedAt);
  formData.set("originalName", "契約種別");
  return formData;
}

function resetMasterServiceMocks(): void {
  vi.mocked(masterService.assertCategoryNameAvailable).mockReset();
  vi.mocked(masterService.createCategory).mockReset();
  vi.mocked(masterService.updateCategory).mockReset();
}

describe("master/actions createMasterCategoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが確認する場合", () => {
    it("前後の空白を除去して重複を確認し、データベースへ登録せず確認状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        createMasterCategoryAction(initialState, createFormData("  契約種別  ", "confirm")),
      ).resolves.toEqual({ mode: "create", phase: "confirm", name: "契約種別" });
      expect(masterService.assertCategoryNameAvailable).toHaveBeenCalledWith("契約種別");
      expect(masterService.createCategory).not.toHaveBeenCalled();
    });
  });

  describe("OPERATORが確認状態から実行する場合", () => {
    it("実行者IDを渡して登録し、一覧キャッシュを無効化して登録先の詳細画面へ遷移する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "operator",
        role: "OPERATOR",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.createCategory).mockResolvedValue({
        id: 12,
        code: "0012",
        name: "契約種別",
        masterCount: 0,
      });

      await expect(
        createMasterCategoryAction(
          { mode: "create", phase: "confirm", name: "契約種別" },
          createFormData("契約種別", "execute"),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.createCategory).toHaveBeenCalledWith({ name: "契約種別" }, "operator");
      expect(revalidatePath).toHaveBeenCalledWith("/master/categories");
      expect(redirect).toHaveBeenCalledWith("/master/categories/12?created=1");
    });
  });

  describe("VIEWERが確認しようとした場合", () => {
    it("AppError(FORBIDDEN) を投げ、重複確認も登録も行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        createMasterCategoryAction(initialState, createFormData("契約種別", "confirm")),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.assertCategoryNameAvailable).not.toHaveBeenCalled();
      expect(masterService.createCategory).not.toHaveBeenCalled();
    });
  });

  describe("確認時に同じ名称が登録済みの場合", () => {
    it("重複メッセージと入力値を入力状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.assertCategoryNameAvailable).mockRejectedValue(
        new AppError("MASTER_CATEGORY_CONFLICT", 409, "同じ名前のマスタ分類が登録されています"),
      );

      await expect(
        createMasterCategoryAction(initialState, createFormData("契約種別", "confirm")),
      ).resolves.toEqual({
        mode: "create",
        phase: "input",
        name: "契約種別",
        error: "同じ名前のマスタ分類が登録されています",
      });
    });
  });

  describe("実行時に同じ名称が先に登録された場合", () => {
    it("重複メッセージと入力値を確認状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.createCategory).mockRejectedValue(
        new AppError("MASTER_CATEGORY_CONFLICT", 409, "同じ名前のマスタ分類が登録されています"),
      );

      await expect(
        createMasterCategoryAction(
          { mode: "create", phase: "confirm", name: "契約種別" },
          createFormData("契約種別", "execute"),
        ),
      ).resolves.toEqual({
        mode: "create",
        phase: "confirm",
        name: "契約種別",
        error: "同じ名前のマスタ分類が登録されています",
      });
    });
  });
});

describe("master/actions updateMasterCategoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが更新内容を確認する場合", () => {
    it("対象自身を除外して重複を確認し、変更前後の値を保持した確認状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        updateMasterCategoryAction(
          updateInitialState,
          createUpdateFormData("  新しい契約種別  ", "confirm"),
        ),
      ).resolves.toEqual({
        ...updateInitialState,
        phase: "confirm",
        name: "新しい契約種別",
      });
      expect(masterService.assertCategoryNameAvailable).toHaveBeenCalledWith("新しい契約種別", 12);
      expect(masterService.updateCategory).not.toHaveBeenCalled();
    });
  });

  describe("OPERATORが確認状態から実行する場合", () => {
    it("更新時点と実行者IDを渡し、一覧と詳細のキャッシュを無効化して詳細画面へ遷移する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "operator",
        role: "OPERATOR",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      const confirmState = {
        ...updateInitialState,
        phase: "confirm" as const,
        name: "新しい契約種別",
      };

      await expect(
        updateMasterCategoryAction(confirmState, createUpdateFormData("新しい契約種別", "execute")),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.updateCategory).toHaveBeenCalledWith(
        { categoryId: 12, name: "新しい契約種別", updatedAt: new Date(updatedAt) },
        "operator",
      );
      expect(revalidatePath).toHaveBeenNthCalledWith(1, "/master/categories");
      expect(revalidatePath).toHaveBeenNthCalledWith(2, "/master/categories/12");
      expect(redirect).toHaveBeenCalledWith("/master/categories/12?updated=1");
    });
  });

  describe("VIEWERが更新内容を確認しようとした場合", () => {
    it("AppError(FORBIDDEN) を投げ、重複確認も更新も行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        updateMasterCategoryAction(
          updateInitialState,
          createUpdateFormData("新しい契約種別", "confirm"),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.assertCategoryNameAvailable).not.toHaveBeenCalled();
      expect(masterService.updateCategory).not.toHaveBeenCalled();
    });
  });

  describe("確認時に別の分類と名称が重複する場合", () => {
    it("重複メッセージと変更前後の値を入力状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.assertCategoryNameAvailable).mockRejectedValue(
        new AppError("MASTER_CATEGORY_CONFLICT", 409, "同じ名前のマスタ分類が登録されています"),
      );

      await expect(
        updateMasterCategoryAction(updateInitialState, createUpdateFormData("請求区分", "confirm")),
      ).resolves.toEqual({
        ...updateInitialState,
        phase: "input",
        name: "請求区分",
        error: "同じ名前のマスタ分類が登録されています",
      });
    });
  });

  describe("実行時にほかの利用者が先に更新していた場合", () => {
    it("同時更新メッセージと変更前後の値を確認状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "admin",
        role: "ADMIN",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.updateCategory).mockRejectedValue(
        new AppError(
          "MASTER_CONCURRENT_UPDATE",
          409,
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
        ),
      );
      const confirmState = {
        ...updateInitialState,
        phase: "confirm" as const,
        name: "新しい契約種別",
      };

      await expect(
        updateMasterCategoryAction(confirmState, createUpdateFormData("新しい契約種別", "execute")),
      ).resolves.toEqual({
        ...confirmState,
        error:
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      });
    });
  });
});
