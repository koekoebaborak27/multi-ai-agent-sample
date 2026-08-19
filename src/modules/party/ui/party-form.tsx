"use client";

import { useActionState, useEffect, useRef } from "react";
import { createPartyAction, type PartyFormState } from "@/modules/party/actions";
import type { MasterOption } from "@/modules/master";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: PartyFormState = {};

// 契約先の新規登録フォーム。
// 一覧画面の中に置かれ、登録すると同じ画面のまま一覧へ反映される。
// 分類は「契約先分類」マスタ分類配下のマスタから選ぶ。該当するマスタ分類が
// 登録されていない場合は選択肢が無いため、プルダウンの代わりに案内文を表示する。
export function PartyForm({ companyTypeOptions }: { companyTypeOptions: MasterOption[] }) {
  const [state, formAction, pending] = useActionState(createPartyAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // 登録に成功したら入力欄を空に戻す。続けて別の契約先を登録しやすくするため。
  useEffect(() => {
    if (state.success) formRef.current?.reset();
  }, [state.success]);

  return (
    <form ref={formRef} action={formAction} className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="name">名称</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="companyTypeMasterId">分類</Label>
        {companyTypeOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">未設定（契約先分類マスタが未登録です）</p>
        ) : (
          <select
            id="companyTypeMasterId"
            name="companyTypeMasterId"
            defaultValue=""
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          >
            <option value="">未設定</option>
            {companyTypeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.content}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="space-y-2 md:col-span-2">
        <Label htmlFor="contactInfo">連絡先</Label>
        <Input id="contactInfo" name="contactInfo" />
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-destructive md:col-span-2">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="text-sm text-green-600 md:col-span-2">契約先を登録しました</p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={pending}>
          {pending ? "登録中..." : "契約先を登録"}
        </Button>
      </div>
    </form>
  );
}
