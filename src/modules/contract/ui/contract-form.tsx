"use client";

import { useActionState, useEffect, useRef } from "react";
import { createContractAction, type ContractFormState } from "@/modules/contract/actions";
import type { MasterOption } from "@/modules/master";
import type { PartySummary } from "@/modules/party";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: ContractFormState = {};
// 状態プルダウンの選択肢。入力チェック側の定義（validation.ts）と同じ並びにしておく
const STATUS_OPTIONS = ["DRAFT", "ACTIVE", "TERMINATED"] as const;

// 契約の新規登録フォーム。
// 一覧画面の中に置かれ、登録すると同じ画面のまま一覧へ反映される。
// 契約分類は「契約分類」マスタ分類配下のマスタから選ぶ。該当するマスタ分類が
// 登録されていない場合は選択肢が無いため、プルダウンの代わりに案内文を表示する。
export function ContractForm({
  parties,
  categoryOptions,
}: {
  parties: PartySummary[];
  categoryOptions: MasterOption[];
}) {
  const [state, formAction, pending] = useActionState(createContractAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 登録に成功したら入力欄を空に戻す。続けて別の契約を登録しやすくするため。
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="partyId">契約先</Label>
        <select
          id="partyId"
          name="partyId"
          required
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="">選択してください</option>
          {parties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="title">契約名</Label>
        <Input id="title" name="title" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">開始日</Label>
        <Input id="startDate" name="startDate" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">終了日</Label>
        <Input id="endDate" name="endDate" type="date" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="status">状態</Label>
        <select
          id="status"
          name="status"
          defaultValue="DRAFT"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="categoryMasterId">契約分類</Label>
        {categoryOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">未設定（契約分類マスタが未登録です）</p>
        ) : (
          <select
            id="categoryMasterId"
            name="categoryMasterId"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">未設定</option>
            {categoryOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.content}
              </option>
            ))}
          </select>
        )}
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {state.error}
        </p>
      )}
      {state.success && <p className="text-sm text-green-600 md:col-span-2">契約を登録しました</p>}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "登録中..." : "契約を登録"}
        </Button>
      </div>
    </form>
  );
}
