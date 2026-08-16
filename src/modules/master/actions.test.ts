/**
 * 対象: master/actions マスタの登録とマスタ分類の登録・更新
 * 目的: 書き込み権限、確認時の事前検査、実行時の登録・更新と詳細画面への遷移を担保する
 */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createMasterAction,
  createMasterCategoryAction,
  deleteMasterAction,
  deleteMasterCategoryAction,
  requestMasterExcelExportAction,
  updateMasterAction,
  updateMasterCategoryAction,
  type DeleteMasterCategoryFormState,
  type DeleteMasterFormState,
  type MasterCategoryFormState,
  type MasterFormState,
} from "@/modules/master/actions";
import { masterService } from "@/modules/master/service";
import { getCurrentUser } from "@/shared/auth/session";
import { AppError } from "@/shared/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

// 業務処理そのものは別の試験で確認しているため、ここでは差し替える。
// この試験で見たいのは「権限の確認・入力チェック・呼び出しの内容・移動先」だけ。
vi.mock("@/modules/master/service", () => ({
  masterService: {
    assertCategoryExists: vi.fn(),
    assertMasterCodeAvailable: vi.fn(),
    createMaster: vi.fn(),
    updateMaster: vi.fn(),
    deleteMaster: vi.fn(),
    assertCategoryNameAvailable: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    requestExcelExport: vi.fn(),
  },
}));

// ログイン中の利用者を試験ごとに自由に差し替えられるようにする（権限の違いを試すため）
vi.mock("@/shared/auth/session", () => ({
  getCurrentUser: vi.fn(),
}));

// 記録を残す包みは、中身をそのまま返すだけにする。
// 記録の内容はこの試験の対象ではなく、包んだままだと確認したい処理に届きにくいため。
vi.mock("@/shared/observability/with-op", () => ({
  withOp: (_op: string, fn: unknown) => fn,
}));

// 表示内容の更新指示は、呼ばれたかどうかだけを確認したいので中身を差し替える
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// 画面移動は試験環境では実行できないため、代わりにエラーを発生させる。
// 本来の動きも「その場で処理を打ち切る」ものなので、以降の処理が走らない点は同じになる。
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
  vi.mocked(masterService.assertCategoryExists).mockReset();
  vi.mocked(masterService.assertMasterCodeAvailable).mockReset();
  vi.mocked(masterService.createMaster).mockReset();
  vi.mocked(masterService.updateMaster).mockReset();
  vi.mocked(masterService.deleteMaster).mockReset();
  vi.mocked(masterService.assertCategoryNameAvailable).mockReset();
  vi.mocked(masterService.createCategory).mockReset();
  vi.mocked(masterService.updateCategory).mockReset();
  vi.mocked(masterService.deleteCategory).mockReset();
  vi.mocked(masterService.requestExcelExport).mockReset();
}

const admin = {
  id: "admin",
  role: "ADMIN",
  mustChangePassword: false,
  authMethod: "credentials",
} as const;

const masterReturnTo = "/master?categoryId=12&page=2";
const masterInitialState: MasterFormState = {
  mode: "create",
  phase: "input",
  returnTo: masterReturnTo,
};

function createMasterFormData(
  intent: "confirm" | "execute",
  overrides: Partial<Record<"categoryId" | "code" | "content" | "returnTo", string>> = {},
): FormData {
  const formData = new FormData();
  formData.set("intent", intent);
  formData.set("categoryId", overrides.categoryId ?? "12");
  formData.set("code", overrides.code ?? "CON-01");
  formData.set("content", overrides.content ?? "月額契約");
  formData.set("returnTo", overrides.returnTo ?? masterReturnTo);
  return formData;
}

const masterUpdateInitialState: MasterFormState = {
  mode: "update",
  phase: "input",
  masterId: 41,
  categoryId: 12,
  code: "CON-01",
  content: "月額契約",
  returnTo: masterReturnTo,
  updatedAt,
  originalCategoryId: 12,
  originalCategoryName: "契約種別",
  originalCode: "CON-01",
  originalContent: "月額契約",
};

function createMasterUpdateFormData(
  intent: "confirm" | "execute",
  overrides: Partial<
    Record<
      | "masterId"
      | "categoryId"
      | "code"
      | "content"
      | "returnTo"
      | "updatedAt"
      | "originalCategoryId"
      | "originalCategoryName"
      | "originalCode"
      | "originalContent",
      string
    >
  > = {},
): FormData {
  const formData = new FormData();
  formData.set("intent", intent);
  formData.set("masterId", overrides.masterId ?? "41");
  formData.set("categoryId", overrides.categoryId ?? "12");
  formData.set("code", overrides.code ?? "CON-01");
  formData.set("content", overrides.content ?? "月額契約");
  formData.set("updatedAt", overrides.updatedAt ?? updatedAt);
  formData.set("returnTo", overrides.returnTo ?? masterReturnTo);
  formData.set("originalCategoryId", overrides.originalCategoryId ?? "12");
  formData.set("originalCategoryName", overrides.originalCategoryName ?? "契約種別");
  formData.set("originalCode", overrides.originalCode ?? "CON-01");
  formData.set("originalContent", overrides.originalContent ?? "月額契約");
  return formData;
}

describe("master/actions createMasterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが確認する場合", () => {
    it("分類の存在とコード重複を確認し、データベースへ登録せず確認状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        createMasterAction(
          masterInitialState,
          createMasterFormData("confirm", { code: "  CON-01  ", content: "  月額契約  " }),
        ),
      ).resolves.toEqual({
        mode: "create",
        phase: "confirm",
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        returnTo: masterReturnTo,
      });
      expect(masterService.assertCategoryExists).toHaveBeenCalledWith(12);
      expect(masterService.assertMasterCodeAvailable).toHaveBeenCalledWith(12, "CON-01");
      expect(masterService.createMaster).not.toHaveBeenCalled();
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
      vi.mocked(masterService.createMaster).mockResolvedValue({
        id: 41,
        categoryId: 12,
        categoryName: "契約種別",
        code: "CON-01",
        content: "月額契約",
      });

      await expect(
        createMasterAction(
          { ...masterInitialState, phase: "confirm" },
          createMasterFormData("execute"),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.createMaster).toHaveBeenCalledWith(
        { categoryId: 12, code: "CON-01", content: "月額契約" },
        "operator",
      );
      expect(revalidatePath).toHaveBeenCalledWith("/master");
      expect(redirect).toHaveBeenCalledWith(
        `/master/41?created=1&returnTo=${encodeURIComponent(masterReturnTo)}`,
      );
    });
  });

  describe("VIEWERが確認しようとした場合", () => {
    it("AppError(FORBIDDEN) を投げ、事前検査も登録も行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        createMasterAction(masterInitialState, createMasterFormData("confirm")),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.assertCategoryExists).not.toHaveBeenCalled();
      expect(masterService.createMaster).not.toHaveBeenCalled();
    });
  });

  describe("マスタ分類が未選択の場合", () => {
    it("入力値を保持したまま入力状態へ戻し、事前検査を行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        createMasterAction(masterInitialState, createMasterFormData("confirm", { categoryId: "" })),
      ).resolves.toEqual({
        mode: "create",
        phase: "input",
        categoryId: undefined,
        code: "CON-01",
        content: "月額契約",
        returnTo: masterReturnTo,
        error: "マスタ分類を選択してください",
      });
      expect(masterService.assertCategoryExists).not.toHaveBeenCalled();
    });
  });

  describe("確認時に同じ分類へ同じコードが登録済みの場合", () => {
    it("重複メッセージと入力値を入力状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.assertMasterCodeAvailable).mockRejectedValue(
        new AppError(
          "MASTER_CODE_CONFLICT",
          409,
          "同じマスタ分類に同じマスタコードが登録されています",
        ),
      );

      await expect(
        createMasterAction(masterInitialState, createMasterFormData("confirm")),
      ).resolves.toEqual({
        mode: "create",
        phase: "input",
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        returnTo: masterReturnTo,
        error: "同じマスタ分類に同じマスタコードが登録されています",
      });
    });
  });

  describe("実行時に別の利用者が同じコードを先に登録した場合", () => {
    it("重複メッセージと入力値を確認状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.createMaster).mockRejectedValue(
        new AppError(
          "MASTER_CODE_CONFLICT",
          409,
          "同じマスタ分類に同じマスタコードが登録されています",
        ),
      );

      await expect(
        createMasterAction(
          { ...masterInitialState, phase: "confirm" },
          createMasterFormData("execute"),
        ),
      ).resolves.toEqual({
        mode: "create",
        phase: "confirm",
        categoryId: 12,
        code: "CON-01",
        content: "月額契約",
        returnTo: masterReturnTo,
        error: "同じマスタ分類に同じマスタコードが登録されています",
      });
    });
  });

  describe("戻り先URLが改ざんされた場合", () => {
    it("マスタ検索一覧を戻り先として保持する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        createMasterAction(
          masterInitialState,
          createMasterFormData("confirm", { returnTo: "https://example.com" }),
        ),
      ).resolves.toMatchObject({ returnTo: "/master" });
    });
  });
});

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

describe("master/actions updateMasterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが更新内容を確認する場合", () => {
    it("対象自身を除外して重複を確認し、変更前後の値を保持した確認状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        updateMasterAction(
          masterUpdateInitialState,
          createMasterUpdateFormData("confirm", { code: "  CON-02  ", content: "  年額契約  " }),
        ),
      ).resolves.toEqual({
        ...masterUpdateInitialState,
        phase: "confirm",
        code: "CON-02",
        content: "年額契約",
      });
      expect(masterService.assertCategoryExists).toHaveBeenCalledWith(12);
      expect(masterService.assertMasterCodeAvailable).toHaveBeenCalledWith(12, "CON-02", 41);
      expect(masterService.updateMaster).not.toHaveBeenCalled();
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
      const confirmState: MasterFormState = {
        ...masterUpdateInitialState,
        phase: "confirm",
        code: "CON-02",
        content: "年額契約",
      };

      await expect(
        updateMasterAction(
          confirmState,
          createMasterUpdateFormData("execute", { code: "CON-02", content: "年額契約" }),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.updateMaster).toHaveBeenCalledWith(
        {
          masterId: 41,
          categoryId: 12,
          code: "CON-02",
          content: "年額契約",
          updatedAt: new Date(updatedAt),
        },
        "operator",
      );
      expect(revalidatePath).toHaveBeenNthCalledWith(1, "/master");
      expect(revalidatePath).toHaveBeenNthCalledWith(2, "/master/41");
      expect(redirect).toHaveBeenCalledWith(
        `/master/41?updated=1&returnTo=${encodeURIComponent(masterReturnTo)}`,
      );
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
        updateMasterAction(masterUpdateInitialState, createMasterUpdateFormData("confirm")),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.assertCategoryExists).not.toHaveBeenCalled();
      expect(masterService.updateMaster).not.toHaveBeenCalled();
    });
  });

  describe("マスタ分類が未選択の場合", () => {
    it("入力値を保持したまま入力状態へ戻し、事前検査を行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        updateMasterAction(
          masterUpdateInitialState,
          createMasterUpdateFormData("confirm", { categoryId: "" }),
        ),
      ).resolves.toEqual({
        ...masterUpdateInitialState,
        phase: "input",
        categoryId: undefined,
        error: "マスタ分類を選択してください",
      });
      expect(masterService.assertCategoryExists).not.toHaveBeenCalled();
    });
  });

  describe("確認時に別のマスタが変更後の分類とコードを使用している場合", () => {
    it("重複メッセージと変更前後の値を入力状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.assertMasterCodeAvailable).mockRejectedValue(
        new AppError(
          "MASTER_CODE_CONFLICT",
          409,
          "同じマスタ分類に同じマスタコードが登録されています",
        ),
      );

      await expect(
        updateMasterAction(
          masterUpdateInitialState,
          createMasterUpdateFormData("confirm", { code: "CON-99" }),
        ),
      ).resolves.toEqual({
        ...masterUpdateInitialState,
        phase: "input",
        code: "CON-99",
        error: "同じマスタ分類に同じマスタコードが登録されています",
      });
    });
  });

  describe("実行時にほかの利用者が先に更新していた場合", () => {
    it("同時更新メッセージと変更前後の値を確認状態へ返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.updateMaster).mockRejectedValue(
        new AppError(
          "MASTER_CONCURRENT_UPDATE",
          409,
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
        ),
      );
      const confirmState: MasterFormState = {
        ...masterUpdateInitialState,
        phase: "confirm",
        code: "CON-02",
        content: "年額契約",
      };

      await expect(
        updateMasterAction(
          confirmState,
          createMasterUpdateFormData("execute", { code: "CON-02", content: "年額契約" }),
        ),
      ).resolves.toEqual({
        ...confirmState,
        error:
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      });
    });
  });

  describe("戻り先URLが改ざんされた場合", () => {
    it("マスタ検索一覧を戻り先として保持する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        updateMasterAction(
          masterUpdateInitialState,
          createMasterUpdateFormData("confirm", { returnTo: "https://example.com" }),
        ),
      ).resolves.toMatchObject({ returnTo: "/master" });
    });
  });
});

const masterDeleteInitialState: DeleteMasterFormState = {
  masterId: 41,
  categoryName: "契約種別",
  code: "CON-01",
  content: "月額契約",
  returnTo: masterReturnTo,
  updatedAt,
};

function createMasterDeleteFormData(
  overrides: Partial<Record<"masterId" | "updatedAt" | "returnTo", string>> = {},
): FormData {
  const formData = new FormData();
  formData.set("masterId", overrides.masterId ?? "41");
  formData.set("updatedAt", overrides.updatedAt ?? updatedAt);
  formData.set("returnTo", overrides.returnTo ?? masterReturnTo);
  return formData;
}

describe("master/actions deleteMasterAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが削除する場合", () => {
    it("更新時点を渡して削除し、一覧のキャッシュを無効化して、削除完了の印付きで戻り先へ遷移する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.deleteMaster).mockResolvedValue({
        categoryName: "契約種別",
        code: "CON-01",
        content: "月額契約",
      });

      await expect(
        deleteMasterAction(masterDeleteInitialState, createMasterDeleteFormData()),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.deleteMaster).toHaveBeenCalledWith({
        masterId: 41,
        updatedAt: new Date(updatedAt),
      });
      expect(revalidatePath).toHaveBeenCalledWith("/master");
      expect(redirect).toHaveBeenCalledWith(`${masterReturnTo}&deleted=1`);
    });
  });

  describe("VIEWERが削除しようとした場合", () => {
    it("AppError(FORBIDDEN) を投げ、削除は行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        deleteMasterAction(masterDeleteInitialState, createMasterDeleteFormData()),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.deleteMaster).not.toHaveBeenCalled();
    });
  });

  describe("実行時にほかの利用者が先に更新・削除していた場合", () => {
    it("同時更新メッセージを保持した状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.deleteMaster).mockRejectedValue(
        new AppError(
          "MASTER_CONCURRENT_UPDATE",
          409,
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
        ),
      );

      await expect(
        deleteMasterAction(masterDeleteInitialState, createMasterDeleteFormData()),
      ).resolves.toEqual({
        ...masterDeleteInitialState,
        masterId: 41,
        updatedAt,
        error:
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("マスタIDが不正な場合", () => {
    it("入力エラーとして状態へ返し、削除は行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        deleteMasterAction(masterDeleteInitialState, createMasterDeleteFormData({ masterId: "0" })),
      ).resolves.toEqual({
        ...masterDeleteInitialState,
        error: "マスタIDが不正です",
      });
      expect(masterService.deleteMaster).not.toHaveBeenCalled();
    });
  });
});

const masterCategoryDeleteInitialState: DeleteMasterCategoryFormState = {
  categoryId: 12,
  code: "0012",
  name: "契約種別",
  updatedAt,
};

function createMasterCategoryDeleteFormData(
  overrides: Partial<Record<"categoryId" | "updatedAt", string>> = {},
): FormData {
  const formData = new FormData();
  formData.set("categoryId", overrides.categoryId ?? "12");
  formData.set("updatedAt", overrides.updatedAt ?? updatedAt);
  return formData;
}

describe("master/actions deleteMasterCategoryAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMasterServiceMocks();
  });

  describe("ADMINが削除する場合", () => {
    it("更新時点を渡して削除し、分類一覧のキャッシュを無効化して、削除完了の印付きで一覧へ遷移する", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.deleteCategory).mockResolvedValue({
        code: "0012",
        name: "契約種別",
      });

      await expect(
        deleteMasterCategoryAction(
          masterCategoryDeleteInitialState,
          createMasterCategoryDeleteFormData(),
        ),
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(masterService.deleteCategory).toHaveBeenCalledWith({
        categoryId: 12,
        updatedAt: new Date(updatedAt),
      });
      expect(revalidatePath).toHaveBeenCalledWith("/master/categories");
      expect(redirect).toHaveBeenCalledWith("/master/categories?deleted=1");
    });
  });

  describe("VIEWERが削除しようとした場合", () => {
    it("AppError(FORBIDDEN) を投げ、削除は行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });

      await expect(
        deleteMasterCategoryAction(
          masterCategoryDeleteInitialState,
          createMasterCategoryDeleteFormData(),
        ),
      ).rejects.toMatchObject({ code: "FORBIDDEN", httpStatus: 403 });
      expect(masterService.deleteCategory).not.toHaveBeenCalled();
    });
  });

  describe("配下にマスタが存在する場合", () => {
    it("削除できない旨のメッセージを保持した状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.deleteCategory).mockRejectedValue(
        new AppError(
          "MASTER_CATEGORY_HAS_MASTERS",
          409,
          "配下にマスタが登録されているため削除できません。先に配下のマスタを削除してください。",
          { id: 12, masterCount: 3 },
        ),
      );

      await expect(
        deleteMasterCategoryAction(
          masterCategoryDeleteInitialState,
          createMasterCategoryDeleteFormData(),
        ),
      ).resolves.toEqual({
        ...masterCategoryDeleteInitialState,
        categoryId: 12,
        updatedAt,
        error:
          "配下にマスタが登録されているため削除できません。先に配下のマスタを削除してください。",
      });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("実行時にほかの利用者が先に更新・削除していた場合", () => {
    it("同時更新メッセージを保持した状態を返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.deleteCategory).mockRejectedValue(
        new AppError(
          "MASTER_CONCURRENT_UPDATE",
          409,
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
        ),
      );

      await expect(
        deleteMasterCategoryAction(
          masterCategoryDeleteInitialState,
          createMasterCategoryDeleteFormData(),
        ),
      ).resolves.toEqual({
        ...masterCategoryDeleteInitialState,
        categoryId: 12,
        updatedAt,
        error:
          "ほかの利用者によって更新されています。最新の内容を確認してから、もう一度操作してください。",
      });
      expect(redirect).not.toHaveBeenCalled();
    });
  });

  describe("マスタ分類IDが不正な場合", () => {
    it("入力エラーとして状態へ返し、削除は行わない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });

      await expect(
        deleteMasterCategoryAction(
          masterCategoryDeleteInitialState,
          createMasterCategoryDeleteFormData({ categoryId: "0" }),
        ),
      ).resolves.toEqual({
        ...masterCategoryDeleteInitialState,
        error: "マスタ分類IDが不正です",
      });
      expect(masterService.deleteCategory).not.toHaveBeenCalled();
    });
  });
});

describe("master/actions requestMasterExcelExportAction", () => {
  beforeEach(() => {
    resetMasterServiceMocks();
  });

  describe("未ログインの場合", () => {
    it("AppError(UNAUTHORIZED) を投げ、依頼処理を呼ばない", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null);

      await expect(requestMasterExcelExportAction()).rejects.toMatchObject({
        code: "UNAUTHORIZED",
        httpStatus: 401,
      });
      expect(masterService.requestExcelExport).not.toHaveBeenCalled();
    });
  });

  describe("VIEWERでログインしている場合", () => {
    it("拒否せずrequestExcelExportを呼び出す（全ロールが実行可能な仕様のため）", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: "viewer",
        role: "VIEWER",
        mustChangePassword: false,
        authMethod: "credentials",
      });
      vi.mocked(masterService.requestExcelExport).mockResolvedValue({ exportId: "export-1" });

      const result = await requestMasterExcelExportAction();

      expect(masterService.requestExcelExport).toHaveBeenCalledWith("viewer");
      expect(result).toEqual({ exportId: "export-1" });
    });
  });

  describe("ADMINでログインしている場合", () => {
    it("requestExcelExportの戻り値をそのまま返す", async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({ ...admin });
      vi.mocked(masterService.requestExcelExport).mockResolvedValue({ exportId: "export-2" });

      const result = await requestMasterExcelExportAction();

      expect(masterService.requestExcelExport).toHaveBeenCalledWith("admin");
      expect(result).toEqual({ exportId: "export-2" });
    });
  });
});
