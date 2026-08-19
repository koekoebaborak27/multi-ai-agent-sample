"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createContractAction, type ContractFormState } from "@/modules/contract/actions";
import { ContractConfirmation } from "@/modules/contract/ui/contract-confirmation";
import { ContractFormFields } from "@/modules/contract/ui/contract-form-fields";
import type { PartyComboboxOption } from "@/modules/contract/ui/party-combobox";
import type { MasterOption } from "@/modules/master";
import { Button } from "@/shared/ui/button";

interface ContractCreateFormProps {
  partyOptions: PartyComboboxOption[];
  categoryOptions: MasterOption[];
  returnTo: string;
}

// 契約の新規登録フォーム（CTR-02）。
// 「確認する」を押すと同じ画面が確認表示（CTR-03）へ切り替わり、そこで「実行」を押すと登録される。
export function ContractCreateForm({
  partyOptions,
  categoryOptions,
  returnTo,
}: ContractCreateFormProps) {
  const initialState: ContractFormState = {
    mode: "create",
    phase: "input",
    returnTo,
    status: "DRAFT",
  };
  const [state, formAction, pending] = useActionState(createContractAction, initialState);
  // 確認画面で「入力内容を修正」が押されたときの状態を覚えておく。
  // 修正を押した時点の状態と現在の状態が同じ間は、入力画面へ戻したままにする。
  const [editingState, setEditingState] = useState<ContractFormState | null>(null);
  const hasParties = partyOptions.length > 0;

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
      <input type="hidden" name="returnTo" value={returnTo} />

      <ContractFormFields
        mode="create"
        partyOptions={partyOptions}
        defaultPartyId={state.partyId}
        defaultTitle={state.title}
        defaultStartDate={state.startDate}
        defaultEndDate={state.endDate}
        defaultStatus={state.status}
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
        <Button type="submit" name="intent" value="confirm" disabled={pending || !hasParties}>
          {pending ? "確認中..." : "確認する"}
        </Button>
        <Button asChild variant="outline">
          <Link href={returnTo}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
