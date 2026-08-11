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

// 分類の選択肢は空の文字列を扱えないため、「すべて」を表す専用の文字列を用意する
const ALL_CATEGORIES = "all";

interface MasterSearchFormProps {
  categories: MasterCategoryOption[];
  initialCategoryId?: number;
  defaultCategoryId?: number;
  initialKeyword?: string;
  currentSort: MasterSortField;
  currentOrder: SortOrder;
}

// マスタ一覧の検索条件フォーム。
// 入力内容はこの画面の中だけで保持し、検索ボタンが押されたときにURLへ変換して画面遷移する。
// こうすることで、検索結果を表示する側（page.tsx）はURLの内容を見るだけでよくなり、
// 入力内容の管理を二重に持たずに済む。
export function MasterSearchForm({
  categories,
  initialCategoryId,
  defaultCategoryId,
  initialKeyword,
  currentSort,
  currentOrder,
}: MasterSearchFormProps) {
  const router = useRouter();
  // 入力欄の初期値。ページを開いたときのURLの内容をそのまま使う。
  // page.tsx 側でこのコンポーネントに渡す key に分類・キーワードを含めているため、
  // URLが変わるとこのコンポーネントが作り直され、初期値も最新のURLに合わせて更新される。
  const [categoryId, setCategoryId] = useState(
    initialCategoryId === undefined ? ALL_CATEGORIES : String(initialCategoryId),
  );
  const [keyword, setKeyword] = useState(initialKeyword ?? "");
  // 画面遷移が終わるまでボタンを押せなくする。連続で押されて二重に検索が実行されるのを防ぐ。
  const [isPending, startTransition] = useTransition();

  // 検索ボタンが押されたときの処理。
  // 選んだ分類・入力したキーワードをURLに詰めて一覧画面へ移動する（ページ番号は指定しないので1ページ目から表示する）。
  // 現在の並び順は変えたくないので、そのまま引き継ぐ。
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

  // 「条件をクリア」ボタンが押されたときの処理。
  // 検索条件・並び順をすべて初期状態に戻し、条件なしの一覧画面へ移動する。
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
