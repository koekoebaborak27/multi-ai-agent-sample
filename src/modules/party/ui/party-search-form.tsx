"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { PartySortField } from "@/modules/party/types";
import type { MasterOption } from "@/modules/master";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SearchConditionCard } from "@/shared/ui/search-condition-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

// 分類の選択肢は空の文字列を扱えないため、「すべて」を表す専用の文字列を用意する
const ALL_COMPANY_TYPES = "all";

interface PartySearchFormProps {
  companyTypeOptions: MasterOption[];
  initialCompanyTypeId: number | "all";
  initialKeyword?: string;
  currentSort: PartySortField;
  currentOrder: SortOrder;
}

// 契約先検索一覧の検索条件フォーム。
// 入力内容はこの画面の中だけで保持し、検索ボタンが押されたときにURLへ変換して画面遷移する。
// こうすることで、検索結果を表示する側（page.tsx）はURLの内容を見るだけでよくなる。
export function PartySearchForm({
  companyTypeOptions,
  initialCompanyTypeId,
  initialKeyword,
  currentSort,
  currentOrder,
}: PartySearchFormProps) {
  const router = useRouter();
  const [companyTypeId, setCompanyTypeId] = useState(String(initialCompanyTypeId));
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  // 画面遷移が終わるまでボタンを押せなくする。連続で押されて二重に検索が実行されるのを防ぐ。
  const [isPending, startTransition] = useTransition();

  // 検索ボタンが押されたときの処理。
  // 選んだ分類・入力したキーワードをURLに詰めて一覧画面へ移動する（ページ番号は指定しないので1ページ目から表示する）。
  // 現在の並び順は変えたくないので、そのまま引き継ぐ。
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (companyTypeId !== ALL_COMPANY_TYPES) query.set("companyTypeId", companyTypeId);
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) query.set("keyword", normalizedKeyword);
    if (currentSort !== "name") query.set("sort", currentSort);
    if (currentOrder !== "asc") query.set("order", currentOrder);
    setKeyword(normalizedKeyword);
    const queryString = query.toString();
    startTransition(() => router.push(queryString ? `/parties?${queryString}` : "/parties"));
  }

  // 「条件をクリア」ボタンが押されたときの処理。
  // 検索条件・並び順をすべて初期状態（名称空・分類「すべて」・ページ1）へ戻す。
  function handleClear() {
    setCompanyTypeId(ALL_COMPANY_TYPES);
    setKeyword("");
    startTransition(() => router.push("/parties"));
  }

  return (
    <SearchConditionCard>
      <form className="space-y-4" onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="party-keyword">名称</Label>
            <Input
              id="party-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="契約先名称を入力"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="party-company-type">契約先分類</Label>
            <Select value={companyTypeId} onValueChange={setCompanyTypeId}>
              <SelectTrigger id="party-company-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COMPANY_TYPES}>すべて</SelectItem>
                {companyTypeOptions.map((option) => (
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
