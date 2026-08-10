"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { MasterCategoryOption, MasterSortField } from "@/modules/master/types";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SearchConditionCard } from "@/shared/ui/search-condition-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

const ALL_CATEGORIES = "all";

interface MasterSearchFormProps {
  categories: MasterCategoryOption[];
  initialCategoryId?: number;
  defaultCategoryId?: number;
  initialKeyword?: string;
  currentSort: MasterSortField;
  currentOrder: SortOrder;
}

export function MasterSearchForm({
  categories,
  initialCategoryId,
  defaultCategoryId,
  initialKeyword,
  currentSort,
  currentOrder,
}: MasterSearchFormProps) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(
    initialCategoryId === undefined ? ALL_CATEGORIES : String(initialCategoryId),
  );
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    query.set("categoryId", categoryId);
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) query.set("keyword", normalizedKeyword);
    if (currentSort !== "category") query.set("sort", currentSort);
    if (currentOrder !== "asc") query.set("order", currentOrder);
    setKeyword(normalizedKeyword);
    const queryString = query.toString();
    startTransition(() => router.push(queryString ? `/master?${queryString}` : "/master"));
  }

  function handleClear() {
    setCategoryId(defaultCategoryId === undefined ? ALL_CATEGORIES : String(defaultCategoryId));
    setKeyword("");
    startTransition(() => router.push("/master"));
  }

  return (
    <SearchConditionCard>
      <form className="space-y-4" onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="master-category">マスタ分類</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="master-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>すべて</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.code} {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="master-keyword">マスタ文字列</Label>
            <Input
              id="master-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="マスタコード・内容を入力"
            />
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
