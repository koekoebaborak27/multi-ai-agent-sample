"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updatePartyAction, type PartyFormState } from "@/modules/party/actions";
import type { MasterOption } from "@/modules/master";
import { PartyConfirmation } from "@/modules/party/ui/party-confirmation";
import { PartyFormFields } from "@/modules/party/ui/party-form-fields";
import { Button } from "@/shared/ui/button";

interface PartyUpdateFormProps {
  party: {
    id: string;
    name: string;
    companyTypeMasterId: number | null;
    companyTypeLabel: string;
    contactInfo: string | null;
    updatedAt: string;
  };
  companyTypeOptions: MasterOption[];
  returnTo: string;
}

// 契約先の更新フォーム（PTY-05）。
// 新規登録フォームと同じく「確認する」で確認表示（PTY-03）へ切り替わる。
// 更新前の値をoriginalで始まる項目として持ち、確認画面で変更前後を並べて表示する。
export function PartyUpdateForm({ party, companyTypeOptions, returnTo }: PartyUpdateFormProps) {
  const initialState: PartyFormState = {
    mode: "update",
    phase: "input",
    id: party.id,
    name: party.name,
    companyTypeMasterId: party.companyTypeMasterId ?? undefined,
    contactInfo: party.contactInfo ?? undefined,
    returnTo,
    updatedAt: party.updatedAt,
    originalName: party.name,
    originalCompanyTypeMasterId: party.companyTypeMasterId ?? undefined,
    originalCompanyTypeLabel: party.companyTypeLabel,
    originalContactInfo: party.contactInfo ?? undefined,
  };
  const [state, formAction, pending] = useActionState(updatePartyAction, initialState);
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
      {/*
        入力欄として表示しないが処理に必要な値を、見えない項目として一緒に送る。
        updatedAtは他の利用者が先に更新していないかの判断に、
        originalで始まる項目は確認画面で変更前後を並べて表示するために使う。
      */}
      <input type="hidden" name="id" value={party.id} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <input type="hidden" name="originalName" value={state.originalName} />
      <input
        type="hidden"
        name="originalCompanyTypeMasterId"
        value={state.originalCompanyTypeMasterId ?? ""}
      />
      <input
        type="hidden"
        name="originalCompanyTypeLabel"
        value={state.originalCompanyTypeLabel ?? ""}
      />
      <input type="hidden" name="originalContactInfo" value={state.originalContactInfo ?? ""} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <PartyFormFields
        companyTypeOptions={companyTypeOptions}
        defaultName={state.name ?? party.name}
        defaultCompanyTypeId={state.companyTypeMasterId}
        defaultContactInfo={state.contactInfo ?? party.contactInfo ?? undefined}
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
          <Link href={`/parties/${party.id}`}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
