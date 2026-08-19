"use client";

import { useState } from "react";
import type { MasterOption } from "@/modules/master";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

// 分類の選択肢は空の文字列を扱えないため、「未設定」を表す専用の文字列を用意する
const UNSET_COMPANY_TYPE = "none";

interface PartyFormFieldsProps {
  companyTypeOptions: MasterOption[];
  defaultName?: string;
  defaultCompanyTypeId?: number;
  defaultContactInfo?: string;
  hasError?: boolean;
}

// 契約先の名称・分類・連絡先の入力欄。
// 新規登録（PTY-02）・更新（PTY-05）の両方から、同じ入力項目として共用する（§00.7）。
export function PartyFormFields({
  companyTypeOptions,
  defaultName,
  defaultCompanyTypeId,
  defaultContactInfo,
  hasError,
}: PartyFormFieldsProps) {
  const [companyTypeId, setCompanyTypeId] = useState(
    defaultCompanyTypeId !== undefined ? String(defaultCompanyTypeId) : UNSET_COMPANY_TYPE,
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="name">名称</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName ?? ""}
          required
          maxLength={200}
          aria-invalid={hasError ? true : undefined}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="companyTypeMasterId">分類</Label>
        {companyTypeOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">未設定（契約先分類マスタが未登録です）</p>
        ) : (
          <>
            {/* プルダウン部品は選択内容を送信しないため、見えない項目に写して一緒に送る */}
            <input
              type="hidden"
              name="companyTypeMasterId"
              value={companyTypeId === UNSET_COMPANY_TYPE ? "" : companyTypeId}
            />
            <Select value={companyTypeId} onValueChange={setCompanyTypeId}>
              <SelectTrigger id="companyTypeMasterId" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET_COMPANY_TYPE}>未設定</SelectItem>
                {companyTypeOptions.map((option) => (
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
        <Label htmlFor="contactInfo">連絡先</Label>
        <Input
          id="contactInfo"
          name="contactInfo"
          defaultValue={defaultContactInfo ?? ""}
          maxLength={500}
        />
      </div>
    </>
  );
}
