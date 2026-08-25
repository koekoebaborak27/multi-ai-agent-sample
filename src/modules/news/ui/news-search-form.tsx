"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  NEWS_CATEGORIES,
  NEWS_CATEGORY_LABELS,
  type NewsCategory,
  type NewsSortField,
} from "@/modules/news/types";
import type { SortOrder } from "@/shared/api/pagination";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { SearchConditionCard } from "@/shared/ui/search-condition-card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

// Selectは空文字列を選択肢に使えないため、カテゴリを絞り込まない状態を専用の値で表す。
const ALL_CATEGORIES = "all";

interface NewsSearchFormProps {
  initialCategory?: NewsCategory;
  initialKeyword?: string;
  currentSort: NewsSortField;
  currentOrder: SortOrder;
}

// お知らせ管理一覧の検索条件フォーム。
// 入力内容をURLへ移し、検索結果の共有・再読み込み・並び替えで同じ条件を使えるようにする。
export function NewsSearchForm({
  initialCategory,
  initialKeyword,
  currentSort,
  currentOrder,
}: NewsSearchFormProps) {
  const router = useRouter();
  // URLのカテゴリを初期表示へ反映し、未指定なら「すべて」を選ぶ。
  const [category, setCategory] = useState<NewsCategory | typeof ALL_CATEGORIES>(
    initialCategory ?? ALL_CATEGORIES,
  );
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  // 遷移中の二重送信を防ぐため、検索・条件クリアのボタンを一時的に無効にする。
  const [isPending, startTransition] = useTransition();

  // 検索条件をURLへ反映する。
  // 条件を変えるときは1ページ目から表示し、現在の並び順だけを引き継ぐ。
  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = new URLSearchParams();
    if (category !== ALL_CATEGORIES) query.set("category", category);
    const normalizedKeyword = keyword.trim();
    if (normalizedKeyword) query.set("keyword", normalizedKeyword);
    if (currentSort !== "startAt") query.set("sort", currentSort);
    if (currentOrder !== "desc") query.set("order", currentOrder);
    setKeyword(normalizedKeyword);
    const queryString = query.toString();
    startTransition(() => router.push(queryString ? `/news?${queryString}` : "/news"));
  }

  // 検索条件と並び順を初期状態へ戻す。
  function handleClear() {
    setCategory(ALL_CATEGORIES);
    setKeyword("");
    startTransition(() => router.push("/news"));
  }

  return (
    <SearchConditionCard>
      <form className="space-y-4" onSubmit={handleSearch}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="news-category">カテゴリ</Label>
            <Select
              value={category}
              onValueChange={(value) => setCategory(value as NewsCategory | typeof ALL_CATEGORIES)}
            >
              <SelectTrigger id="news-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CATEGORIES}>すべて</SelectItem>
                {NEWS_CATEGORIES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {NEWS_CATEGORY_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="news-keyword">文言</Label>
            <Input
              id="news-keyword"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="タイトル・本文を入力"
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
