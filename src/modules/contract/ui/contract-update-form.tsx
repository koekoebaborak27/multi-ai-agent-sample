"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateContractAction, type ContractFormState } from "@/modules/contract/actions";
import type { ContractStatus } from "@/modules/contract/types";
import { ContractConfirmation } from "@/modules/contract/ui/contract-confirmation";
import { ContractFormFields } from "@/modules/contract/ui/contract-form-fields";
import type { MasterOption } from "@/modules/master";
import { Button } from "@/shared/ui/button";

interface ContractUpdateFormProps {
  contract: {
    id: string;
    partyId: string;
    partyName: string;
    title: string;
    startDate: string;
    endDate: string;
    status: ContractStatus;
    categoryMasterId: number | null;
    categoryLabel: string;
    updatedAt: string;
  };
  categoryOptions: MasterOption[];
  returnTo: string;
}

// 契約の更新フォーム（CTR-05）。
// 新規登録フォームと同じく「確認する」で確認表示（CTR-03）へ切り替わる。
// 契約先は登録時に決めたものから変更できないため、読み取り専用で表示するだけにする（§23.1）。
export function ContractUpdateForm({
  contract,
  categoryOptions,
  returnTo,
}: ContractUpdateFormProps) {
  const initialState: ContractFormState = {
    mode: "update",
    phase: "input",
    id: contract.id,
    partyId: contract.partyId,
    partyName: contract.partyName,
    title: contract.title,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    categoryMasterId: contract.categoryMasterId ?? undefined,
    returnTo,
    updatedAt: contract.updatedAt,
    originalTitle: contract.title,
    originalStartDate: contract.startDate,
    originalEndDate: contract.endDate,
    originalStatus: contract.status,
    originalCategoryMasterId: contract.categoryMasterId ?? undefined,
    originalCategoryLabel: contract.categoryLabel,
  };
  const [state, formAction, pending] = useActionState(updateContractAction, initialState);
  // 確認画面で「入力内容を修正」が押されたときの状態を覚えておく。
  // 修正を押した時点の状態と現在の状態が同じ間は、入力画面へ戻したままにする。
  const [editingState, setEditingState] = useState<ContractFormState | null>(null);

  // 確認の段階になったら、入力欄の代わりに確認画面を表示する
  if (state.phase === "confirm" && editingState !== state) {
    const selectedCategory = categoryOptions.find((option) => option.id === state.categoryMasterId);
    return (
      <ContractConfirmation
        state={state}
        categoryLabel={selectedCategory ? selectedCategory.content : "未設定"}
        pending={pending}
        formAction={formAction}
        onEdit={() => setEditingState(state)}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      {/*
        入力欄として表示しないが処理に必要な値を、見えない項目として一緒に送る。
        updatedAtは他の利用者が先に更新していないかの判断に、
        originalで始まる項目は確認画面で変更前後を並べて表示するために使う。
        partyId・partyNameは契約先が変更できないため、表示専用の値としてそのまま持ち回る。
      */}
      <input type="hidden" name="id" value={contract.id} />
      <input type="hidden" name="partyId" value={state.partyId} />
      <input type="hidden" name="partyName" value={state.partyName} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <input type="hidden" name="originalTitle" value={state.originalTitle} />
      <input type="hidden" name="originalStartDate" value={state.originalStartDate ?? ""} />
      <input type="hidden" name="originalEndDate" value={state.originalEndDate ?? ""} />
      <input type="hidden" name="originalStatus" value={state.originalStatus} />
      <input
        type="hidden"
        name="originalCategoryMasterId"
        value={state.originalCategoryMasterId ?? ""}
      />
      <input type="hidden" name="originalCategoryLabel" value={state.originalCategoryLabel ?? ""} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <ContractFormFields
        mode="update"
        currentPartyName={contract.partyName}
        defaultTitle={state.title ?? contract.title}
        defaultStartDate={state.startDate ?? contract.startDate}
        defaultEndDate={state.endDate ?? contract.endDate}
        defaultStatus={state.status ?? contract.status}
        categoryOptions={categoryOptions}
        defaultCategoryId={state.categoryMasterId}
        hasError={!!state.error}
      />

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="confirm" disabled={pending}>
          {pending ? "確認中..." : "確認する"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/contracts/${contract.id}`}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
