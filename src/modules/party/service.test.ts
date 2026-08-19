/**
 * 対象: party/service 契約先の一覧取得・登録・更新
 * 目的: 契約先分類（マスタ参照）の解決・検証と、一覧表示用の値の組み立てを担保する
 */
import { masterService } from "@/modules/master";
import { partyRepository } from "@/modules/party/repository";
import { partyService } from "@/modules/party/service";
import { AppError } from "@/shared/errors/app-error";
import type { Party } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/party/repository", () => ({
  partyRepository: {
    listAndCount: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/modules/master", () => ({
  masterService: {
    resolveMasterContents: vi.fn(),
    assertMasterInCategoryCode: vi.fn(),
  },
}));

function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: "party-1",
    name: "サンプル契約先",
    companyTypeMasterId: null,
    contactInfo: null,
    createdAt: new Date("2026-08-19T00:00:00.000Z"),
    updatedAt: new Date("2026-08-19T00:00:00.000Z"),
    ...overrides,
  };
}

describe("party/service list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("分類マスタが設定されている契約先を含む場合", () => {
    it("companyTypeMasterIdをまとめて解決し、対応する内容を表示用の値に含める", async () => {
      vi.mocked(partyRepository.listAndCount).mockResolvedValue([
        [makeParty({ id: "party-1", companyTypeMasterId: 41 })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map([[41, "法人"]]));

      const result = await partyService.list(1, 30);

      expect(masterService.resolveMasterContents).toHaveBeenCalledWith([41]);
      expect(result.items[0]).toMatchObject({
        companyTypeMasterId: 41,
        companyTypeLabel: "法人",
      });
    });
  });

  describe("分類マスタが未設定の契約先の場合", () => {
    it("解決対象に含めず、「未設定」を表示用の値にする", async () => {
      vi.mocked(partyRepository.listAndCount).mockResolvedValue([
        [makeParty({ id: "party-1", companyTypeMasterId: null })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      const result = await partyService.list(1, 30);

      expect(masterService.resolveMasterContents).toHaveBeenCalledWith([]);
      expect(result.items[0]).toMatchObject({
        companyTypeMasterId: null,
        companyTypeLabel: "未設定",
      });
    });
  });

  describe("分類マスタが設定されているが解決できなかった（削除済みなど）場合", () => {
    it("「未設定」を表示用の値にする", async () => {
      vi.mocked(partyRepository.listAndCount).mockResolvedValue([
        [makeParty({ id: "party-1", companyTypeMasterId: 99 })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      const result = await partyService.list(1, 30);

      expect(result.items[0].companyTypeLabel).toBe("未設定");
    });
  });
});

describe("party/service create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("分類が選択されている場合", () => {
    it("契約先分類配下のマスタであることを確認してから登録する", async () => {
      vi.mocked(masterService.assertMasterInCategoryCode).mockResolvedValue(undefined);
      vi.mocked(partyRepository.create).mockResolvedValue(
        makeParty({ id: "party-1", companyTypeMasterId: 41 }),
      );
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map([[41, "法人"]]));

      const result = await partyService.create({ name: "サンプル契約先", companyTypeMasterId: 41 });

      expect(masterService.assertMasterInCategoryCode).toHaveBeenCalledWith(
        41,
        "CONTRACT_COMPANY_TYPE",
      );
      expect(partyRepository.create).toHaveBeenCalledWith({
        name: "サンプル契約先",
        companyTypeMasterId: 41,
        contactInfo: null,
      });
      expect(result).toMatchObject({ companyTypeMasterId: 41, companyTypeLabel: "法人" });
    });
  });

  describe("分類が未選択の場合", () => {
    it("分類の検証を行わずに登録する", async () => {
      vi.mocked(partyRepository.create).mockResolvedValue(makeParty());
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      await partyService.create({ name: "サンプル契約先", companyTypeMasterId: undefined });

      expect(masterService.assertMasterInCategoryCode).not.toHaveBeenCalled();
      expect(partyRepository.create).toHaveBeenCalledWith({
        name: "サンプル契約先",
        companyTypeMasterId: null,
        contactInfo: null,
      });
    });
  });

  describe("選択したマスタが契約先分類配下に存在しない場合", () => {
    it("AppError(MASTER_REFERENCE_INVALID) を投げ、登録は行わない", async () => {
      vi.mocked(masterService.assertMasterInCategoryCode).mockRejectedValue(
        new AppError("MASTER_REFERENCE_INVALID", 422, "選択した内容が見つかりません"),
      );

      await expect(
        partyService.create({ name: "サンプル契約先", companyTypeMasterId: 999 }),
      ).rejects.toMatchObject({
        code: "MASTER_REFERENCE_INVALID",
        httpStatus: 422,
      } satisfies Partial<AppError>);
      expect(partyRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe("party/service update", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象の契約先が存在する場合", () => {
    it("契約先分類配下のマスタであることを確認してから更新する", async () => {
      vi.mocked(partyRepository.findById).mockResolvedValue(makeParty({ id: "party-1" }));
      vi.mocked(masterService.assertMasterInCategoryCode).mockResolvedValue(undefined);
      vi.mocked(partyRepository.update).mockResolvedValue(
        makeParty({ id: "party-1", companyTypeMasterId: 42 }),
      );
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map([[42, "個人"]]));

      const result = await partyService.update({
        id: "party-1",
        name: "サンプル契約先",
        companyTypeMasterId: 42,
      });

      expect(masterService.assertMasterInCategoryCode).toHaveBeenCalledWith(
        42,
        "CONTRACT_COMPANY_TYPE",
      );
      expect(result).toMatchObject({ companyTypeMasterId: 42, companyTypeLabel: "個人" });
    });
  });

  describe("対象の契約先が存在しない場合", () => {
    it("AppError(NOT_FOUND) を投げ、分類の検証も更新も行わない", async () => {
      vi.mocked(partyRepository.findById).mockResolvedValue(null);

      await expect(
        partyService.update({ id: "missing", name: "サンプル契約先", companyTypeMasterId: 41 }),
      ).rejects.toMatchObject({ code: "NOT_FOUND", httpStatus: 404 } satisfies Partial<AppError>);
      expect(masterService.assertMasterInCategoryCode).not.toHaveBeenCalled();
      expect(partyRepository.update).not.toHaveBeenCalled();
    });
  });
});
