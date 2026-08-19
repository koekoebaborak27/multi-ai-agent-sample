"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createPartyAction, type PartyFormState } from "@/modules/party/actions";
import type { MasterOption } from "@/modules/master";
import { PartyConfirmation } from "@/modules/party/ui/party-confirmation";
import { PartyFormFields } from "@/modules/party/ui/party-form-fields";
import { Button } from "@/shared/ui/button";

interface PartyCreateFormProps {
  companyTypeOptions: MasterOption[];
  returnTo: string;
}

// 契約先の新規登録フォーム（PTY-02）。
// 「確認する」を押すと同じ画面が確認表示（PTY-03）へ切り替わり、そこで「実行」を押すと登録される。
export function PartyCreateForm({ companyTypeOptions, returnTo }: PartyCreateFormProps) {
  const initialState: PartyFormState = { mode: "create", phase: "input", returnTo };
  const [state, formAction, pending] = useActionState(createPartyAction, initialState);
  // 確認画面で「入力内容を修正」が押されたときの状態を覚えておく。
  // 修正を押した時点の状態と現在の状態が同じ間は、入力画面へ戻したままにする。
  const [editingState, setEditingState] = useState<PartyFormState | null>(null);

  // 確認の段階になったら、入力欄の代わりに確認画面を表示する
  if (state.phase === "confirm" && editingState !== state) {
    const selected = companyTypeOptions.find((option) => option.id === state.companyTypeMasterId);
    return (
      <PartyConfirmation
        state={state}
        companyTypeLabel={selected ? selected.content : "未設定"}
        pending={pending}
        formAction={formAction}
        onEdit={() => setEditingState(state)}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="returnTo" value={returnTo} />

      <PartyFormFields
        companyTypeOptions={companyTypeOptions}
        defaultName={state.name}
        defaultCompanyTypeId={state.companyTypeMasterId}
        defaultContactInfo={state.contactInfo}
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
          <Link href={returnTo}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
