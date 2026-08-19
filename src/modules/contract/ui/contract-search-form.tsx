"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { ContractSortField, ContractStatus } from "@/modules/contract/types";
import { CONTRACT_STATUS_LABELS, CONTRACT_STATUSES } from "@/modules/contract/types";
import { PartyCombobox, type PartyComboboxOption } from "@/modules/contract/ui/party-combobox";
import type { MasterOption } from "@/modules/master";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { SearchConditionCard } from "@/shared/ui/search-condition-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

// 契約先・状態・契約分類の選択肢は空の文字列を扱えないため、「すべて」を表す専用の文字列を用意する
const ALL_PARTIES = "all";
const ALL_STATUSES = "all";
const ALL_CATEGORIES = "all";
const ALL_PARTIES_OPTION: PartyComboboxOption = { id: ALL_PARTIES, name: "すべて" };

interface ContractSearchFormProps {
  partyOptions: PartyComboboxOption[];
  categoryOptions: MasterOption[];
  initialPartyId: string | "all";
  initialStatus: ContractStatus | "all";
  initialCategoryId: number | "all";
  currentSort: ContractSortField;
  currentOrder: SortOrder;
}

// 契約検索一覧の検索条件フォーム。
// 入力内容はこの画面の中だけで保持し、検索ボタンが押されたときにURLへ変換して画面遷移する。
export function ContractSearchForm({
  partyOptions,
  categoryOptions,
  initialPartyId,
  initialStatus,
  initialCategoryId,
  currentSort,
  currentOrder,
}: ContractSearchFormProps) {
  const router = useRouter();
  const [partyId, setPartyId] = useState(initialPartyId);
  const [status, setStatus] = useState(initialStatus);
  const [categoryId, setCategoryId] = useState(String(initialCategoryId));
  // 画面遷移が終わるまでボタンを押せなくする。連続で押されて二重に検索が実行されるのを防ぐ。
  const [isPending, startTransition] = useTransition();

  // 検索ボタンが押されたときの処理。
  // 選んだ契約先・状態・契約分類をURLに詰めて一覧画面へ移動する（ページ番号は指定しないので1ページ目から表示する）。
  // 現在の並び順は変えたくないので、そのまま引き継ぐ。
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (partyId !== ALL_PARTIES) query.set("partyId", partyId);
    if (status !== ALL_STATUSES) query.set("status", status);
    if (categoryId !== ALL_CATEGORIES) query.set("categoryId", categoryId);
    if (currentSort !== "title") query.set("sort", currentSort);
    if (currentOrder !== "asc") query.set("order", currentOrder);
    const queryString = query.toString();
    startTransition(() => router.push(queryString ? `/contracts?${queryString}` : "/contracts"));
  }

  // 「条件をクリア」ボタンが押されたときの処理。
  // 検索条件・並び順をすべて初期状態（すべて「すべて」・ページ1）へ戻す。
  function handleClear() {
    setPartyId(ALL_PARTIES);
    setStatus(ALL_STATUSES);
    setCategoryId(ALL_CATEGORIES);
    startTransition(() => router.push("/contracts"));
  }

  return (
    <SearchConditionCard>
      <form className="space-y-4" onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="contract-party">契約先</Label>
            <PartyCombobox
              id="contract-party"
              options={[ALL_PARTIES_OPTION, ...partyOptions]}
              value={partyId}
              onChange={(value) => setPartyId(value ?? ALL_PARTIES)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contract-status">状態</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as ContractStatus | "all")}
            >
              <SelectTrigger id="contract-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES}>すべて</SelectItem>
                {CONTRACT_STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {CONTRACT_STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="contract-category">契約分類</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="contract-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>すべて</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.content}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col justify-end gap-2 sm:flex-row">
          <Button type="submit" disabled={isPending}>
            検索
          </Button>
          <Button type="button" variant="outline" disabled={isPending} onClick={handleClear}>
            条件をクリア
          </Button>
        </div>
      </form>
    </SearchConditionCard>
  );
}
