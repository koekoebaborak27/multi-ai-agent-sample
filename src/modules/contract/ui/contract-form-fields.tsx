"use client";

import Link from "next/link";
import { useState } from "react";
import {
  CONTRACT_STATUS_LABELS,
  CONTRACT_STATUSES,
  type ContractStatus,
} from "@/modules/contract/types";
import { PartyCombobox, type PartyComboboxOption } from "@/modules/contract/ui/party-combobox";
import type { MasterOption } from "@/modules/master";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

// 契約分類の選択肢は空の文字列を扱えないため、「未設定」を表す専用の文字列を用意する
const UNSET_CATEGORY = "none";

interface ContractFormFieldsProps {
  mode: "create" | "update";
  partyOptions?: PartyComboboxOption[];
  currentPartyName?: string;
  defaultPartyId?: string;
  defaultTitle?: string;
  defaultStartDate?: string;
  defaultEndDate?: string;
  defaultStatus?: ContractStatus;
  categoryOptions: MasterOption[];
  defaultCategoryId?: number;
  hasError?: boolean;
}

/**
 * 契約先・契約名・開始日・終了日・状態・契約分類の入力欄。
 * 新規登録（CTR-02）・更新（CTR-05）の両方から使う（§00.7）。契約先の選択欄は新規登録時のみ
 * 表示し、更新時は現在の契約先を読み取り専用で表示する（契約先は登録後に変更できないため。§23.1）。
 */
export function ContractFormFields({
  mode,
  partyOptions,
  currentPartyName,
  defaultPartyId,
  defaultTitle,
  defaultStartDate,
  defaultEndDate,
  defaultStatus,
  categoryOptions,
  defaultCategoryId,
  hasError,
}: ContractFormFieldsProps) {
  const [partyId, setPartyId] = useState<string | undefined>(defaultPartyId);
  const [status, setStatus] = useState<ContractStatus>(defaultStatus ?? "DRAFT");
  const [categoryId, setCategoryId] = useState(
    defaultCategoryId !== undefined ? String(defaultCategoryId) : UNSET_CATEGORY,
  );
  const hasParties = (partyOptions?.length ?? 0) > 0;

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={mode === "create" ? "partyId" : undefined}>契約先</Label>
        {mode === "update" ? (
          <p className="text-sm">{currentPartyName}</p>
        ) : hasParties ? (
          <>
            {/* コンボボックスは選択内容を送信しないため、見えない項目に写して一緒に送る */}
            <input type="hidden" name="partyId" value={partyId ?? ""} />
            <PartyCombobox
              id="partyId"
              options={partyOptions ?? []}
              value={partyId}
              onChange={setPartyId}
              hasError={hasError}
            />
          </>
        ) : (
          <div className="space-y-3 rounded-md border border-border p-4">
            <p className="text-sm">契約先が登録されていません。先に契約先を登録してください。</p>
            <Button asChild variant="outline" size="sm">
              <Link href="/parties/new">契約先を登録する</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">契約名</Label>
        <Input
          id="title"
          name="title"
          defaultValue={defaultTitle ?? ""}
          required
          maxLength={200}
          aria-invalid={hasError ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoryMasterId">契約分類</Label>
        {categoryOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">未設定（契約分類マスタが未登録です）</p>
        ) : (
          <>
            <input
              type="hidden"
              name="categoryMasterId"
              value={categoryId === UNSET_CATEGORY ? "" : categoryId}
            />
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="categoryMasterId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_CATEGORY}>未設定</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.content}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="startDate">開始日</Label>
        <Input id="startDate" name="startDate" type="date" defaultValue={defaultStartDate ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="endDate">終了日</Label>
        <Input id="endDate" name="endDate" type="date" defaultValue={defaultEndDate ?? ""} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="status">状態</Label>
        {/* プルダウン部品は選択内容を送信しないため、見えない項目に写して一緒に送る */}
        <input type="hidden" name="status" value={status} />
        <Select value={status} onValueChange={(value) => setStatus(value as ContractStatus)}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CONTRACT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {CONTRACT_STATUS_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
