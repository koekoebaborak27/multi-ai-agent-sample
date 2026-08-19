/**
 * 対象: contract/service 契約の一覧取得・登録・更新
 * 目的: 契約分類（マスタ参照）の解決・検証と、一覧表示用の値の組み立てを担保する
 */
import { contractRepository, type ContractWithParty } from "@/modules/contract/repository";
import { contractService } from "@/modules/contract/service";
import { masterService } from "@/modules/master";
import { AppError } from "@/shared/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/contract/repository", () => ({
  contractRepository: {
    listAndCount: vi.fn(),
    findById: vi.fn(),
    findPartyName: vi.fn(),
    create: vi.fn(),
    updateIfUnchanged: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/modules/master", () => ({
  masterService: {
    resolveMasterContents: vi.fn(),
    assertMasterInCategoryCode: vi.fn(),
  },
}));

const baseDate = new Date("2026-08-19T00:00:00.000Z");

function makeContract(overrides: Partial<ContractWithParty> = {}): ContractWithParty {
  return {
    id: "contract-1",
    partyId: "party-1",
    title: "サンプル契約",
    startDate: null,
    endDate: null,
    status: "DRAFT",
    categoryMasterId: null,
    createdAt: baseDate,
    createdBy: null,
    updatedAt: baseDate,
    updatedBy: null,
    party: {
      id: "party-1",
      name: "サンプル契約先",
      companyTypeMasterId: null,
      contactInfo: null,
      createdAt: baseDate,
      createdBy: null,
      updatedAt: baseDate,
      updatedBy: null,
    },
    ...overrides,
  };
}

describe("contract/service list", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("契約分類が設定されている契約を含む場合", () => {
    it("categoryMasterIdをまとめて解決し、対応する内容を表示用の値に含める", async () => {
      vi.mocked(contractRepository.listAndCount).mockResolvedValue([
        [makeContract({ categoryMasterId: 51 })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map([[51, "業務委託"]]));

      const result = await contractService.list({}, 1, 30);

      expect(masterService.resolveMasterContents).toHaveBeenCalledWith([51]);
      expect(result.items[0]).toMatchObject({
        categoryMasterId: 51,
        categoryLabel: "業務委託",
      });
    });
  });

  describe("契約分類が未設定の契約の場合", () => {
    it("解決対象に含めず、「未設定」を表示用の値にする", async () => {
      vi.mocked(contractRepository.listAndCount).mockResolvedValue([
        [makeContract({ categoryMasterId: null })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      const result = await contractService.list({}, 1, 30);

      expect(masterService.resolveMasterContents).toHaveBeenCalledWith([]);
      expect(result.items[0]).toMatchObject({
        categoryMasterId: null,
        categoryLabel: "未設定",
      });
    });
  });

  describe("契約分類が設定されているが解決できなかった（削除済みなど）場合", () => {
    it("「未設定」を表示用の値にする", async () => {
      vi.mocked(contractRepository.listAndCount).mockResolvedValue([
        [makeContract({ categoryMasterId: 99 })],
        1,
      ]);
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      const result = await contractService.list({}, 1, 30);

      expect(result.items[0].categoryLabel).toBe("未設定");
    });
  });
});

describe("contract/service create", () => {
  const input = {
    partyId: "party-1",
    title: "サンプル契約",
    status: "DRAFT" as const,
    categoryMasterId: 51,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("契約分類が選択されている場合", () => {
    it("契約先の存在と契約分類配下のマスタであることを確認してから登録する", async () => {
      vi.mocked(contractRepository.findPartyName).mockResolvedValue("サンプル契約先");
      vi.mocked(masterService.assertMasterInCategoryCode).mockResolvedValue(undefined);
      vi.mocked(contractRepository.create).mockResolvedValue(
        makeContract({ categoryMasterId: 51 }),
      );
      vi.mocked(contractRepository.findById).mockResolvedValue(
        makeContract({ categoryMasterId: 51 }),
      );
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map([[51, "業務委託"]]));

      const result = await contractService.create(input, "user-1");

      expect(contractRepository.findPartyName).toHaveBeenCalledWith("party-1");
      expect(masterService.assertMasterInCategoryCode).toHaveBeenCalledWith(51, "CONTRACT_TYPE");
      expect(contractRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoryMasterId: 51, createdBy: "user-1", updatedBy: "user-1" }),
      );
      expect(result).toMatchObject({ categoryMasterId: 51, categoryLabel: "業務委託" });
    });
  });

  describe("契約分類が未選択の場合", () => {
    it("契約分類の検証を行わずに登録する", async () => {
      vi.mocked(contractRepository.findPartyName).mockResolvedValue("サンプル契約先");
      vi.mocked(contractRepository.create).mockResolvedValue(makeContract());
      vi.mocked(contractRepository.findById).mockResolvedValue(makeContract());
      vi.mocked(masterService.resolveMasterContents).mockResolvedValue(new Map());

      await contractService.create({ ...input, categoryMasterId: undefined }, "user-1");

      expect(masterService.assertMasterInCategoryCode).not.toHaveBeenCalled();
      expect(contractRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ categoryMasterId: null }),
      );
    });
  });

  describe("選択したマスタが契約分類配下に存在しない場合", () => {
    it("AppError(MASTER_REFERENCE_INVALID) を投げ、登録は行わない", async () => {
      vi.mocked(contractRepository.findPartyName).mockResolvedValue("サンプル契約先");
      vi.mocked(masterService.assertMasterInCategoryCode).mockRejectedValue(
        new AppError("MASTER_REFERENCE_INVALID", 422, "選択した内容が見つかりません"),
      );

      await expect(
        contractService.create({ ...input, categoryMasterId: 999 }, "user-1"),
      ).rejects.toMatchObject({
        code: "MASTER_REFERENCE_INVALID",
        httpStatus: 422,
      } satisfies Partial<AppError>);
      expect(contractRepository.create).not.toHaveBeenCalled();
    });
  });

  describe("選択した契約先が存在しない場合", () => {
    it("AppError(PARTY_NOT_FOUND) を投げ、分類の検証も登録も行わない", async () => {
      vi.mocked(contractRepository.findPartyName).mockResolvedValue(null);

      await expect(contractService.create(input, "user-1")).rejects.toMatchObject({
        code: "PARTY_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(masterService.assertMasterInCategoryCode).not.toHaveBeenCalled();
      expect(contractRepository.create).not.toHaveBeenCalled();
    });
  });
});

describe("contract/service update", () => {
  const baseUpdatedAt = new Date("2026-08-19T00:00:00.000Z");
  const input = {
    id: "contract-1",
    title: "サンプル契約",
    status: "ACTIVE" as const,
    categoryMasterId: 52,
    updatedAt: baseUpdatedAt,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("対象の契約が存在し、他の利用者による更新も無い場合", () => {
    it("契約分類配下のマスタであることを確認してから更新する", async () => {
      vi.mocked(contractRepository.findById).mockResolvedValue(
        makeContract({ categoryMasterId: 52, updatedAt: baseUpdatedAt }),
      );
      vi.mocked(masterService.assertMasterInCategoryCode).mockResolvedValue(undefined);
      vi.mocked(contractRepository.updateIfUnchanged).mockResolvedValue(true);

      await contractService.update(input, "user-1");

      expect(masterService.assertMasterInCategoryCode).toHaveBeenCalledWith(52, "CONTRACT_TYPE");
      expect(contractRepository.updateIfUnchanged).toHaveBeenCalledWith(
        "contract-1",
        baseUpdatedAt,
        expect.objectContaining({ categoryMasterId: 52, updatedBy: "user-1" }),
      );
    });
  });

  describe("対象の契約が存在しない場合", () => {
    it("AppError(CONTRACT_NOT_FOUND) を投げ、契約分類の検証も更新も行わない", async () => {
      vi.mocked(contractRepository.findById).mockResolvedValue(null);

      await expect(contractService.update(input, "user-1")).rejects.toMatchObject({
        code: "CONTRACT_NOT_FOUND",
        httpStatus: 404,
      } satisfies Partial<AppError>);
      expect(masterService.assertMasterInCategoryCode).not.toHaveBeenCalled();
      expect(contractRepository.updateIfUnchanged).not.toHaveBeenCalled();
    });
  });

  describe("画面を開いた時点から他の利用者が先に更新していた場合", () => {
    it("AppError(CONTRACT_CONCURRENT_UPDATE) を投げ、更新を行わない", async () => {
      vi.mocked(contractRepository.findById).mockResolvedValue(
        makeContract({ id: "contract-1", updatedAt: new Date("2026-08-19T01:00:00.000Z") }),
      );

      await expect(contractService.update(input, "user-1")).rejects.toMatchObject({
        code: "CONTRACT_CONCURRENT_UPDATE",
        httpStatus: 409,
      } satisfies Partial<AppError>);
      expect(contractRepository.updateIfUnchanged).not.toHaveBeenCalled();
    });
  });
});
