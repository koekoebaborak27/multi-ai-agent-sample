"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createMasterAction, type MasterFormState } from "@/modules/master/actions";
import type { MasterCategoryOption } from "@/modules/master/types";
import { MasterConfirmation } from "@/modules/master/ui/master-confirmation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface MasterCreateFormProps {
  categories: MasterCategoryOption[];
  returnTo: string;
}

// マスタの新規登録フォーム。
// 「確認する」を押すと同じ画面が確認表示へ切り替わり、そこで「実行」を押すと登録される。
export function MasterCreateForm({ categories, returnTo }: MasterCreateFormProps) {
  const initialState: MasterFormState = { mode: "create", phase: "input", returnTo };
  const [state, formAction, pending] = useActionState(createMasterAction, initialState);
  // 確認画面で「入力内容を修正」が押されたときの状態を覚えておく。
  // 修正を押した時点の状態と現在の状態が同じ間は、入力画面へ戻したままにする。
  const [editingState, setEditingState] = useState<MasterFormState | null>(null);
  const [categoryId, setCategoryId] = useState("");
  // 分類が1件も登録されていないとマスタを登録できないため、その場合は案内を表示する
  const hasCategories = categories.length > 0;

  // 確認の段階になったら、入力欄の代わりに確認画面を表示する
  if (state.phase === "confirm" && editingState !== state) {
    const selected = categories.find((category) => category.id === state.categoryId);
    return (
      <MasterConfirmation
        state={state}
        categoryName={selected ? `${selected.code} ${selected.name}` : "—"}
        pending={pending}
        formAction={formAction}
        onEdit={() => setEditingState(state)}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="space-y-2">
        <Label htmlFor={hasCategories ? "categoryId" : undefined}>マスタ分類</Label>
        {hasCategories ? (
          <>
            {/* プルダウン部品は選択内容を送信しないため、見えない項目に写して一緒に送る */}
            <input type="hidden" name="categoryId" value={categoryId} />
            <Select value={categoryId || undefined} onValueChange={setCategoryId}>
              <SelectTrigger
                id="categoryId"
                className="w-full"
                aria-invalid={state.error ? true : undefined}
              >
                <SelectValue placeholder="マスタ分類を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : (
          <div className="space-y-3 rounded-md border border-border p-4">
            <p className="text-sm">
              マスタ分類が登録されていません。先にマスタ分類を登録してください。
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/master/categories/new">マスタ分類を登録する</Link>
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">マスタコード</Label>
        <Input
          id="code"
          name="code"
          defaultValue={state.code ?? ""}
          required
          maxLength={8}
          className="font-mono"
          aria-describedby="code-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="code-help" className="text-sm text-muted-foreground">
          1文字以上8文字以内で、英大文字・数字・ハイフン・アンダースコアだけを入力してください。英小文字は登録できません。
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">マスタ内容</Label>
        <Input
          id="content"
          name="content"
          defaultValue={state.content ?? ""}
          required
          aria-describedby="content-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="content-help" className="text-sm text-muted-foreground">
          1文字以上30文字以内で入力してください。前後の空白は登録時に除去されます。
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="confirm" disabled={pending || !hasCategories}>
          {pending ? "確認中..." : "確認する"}
        </Button>
        <Button asChild variant="outline">
          <Link href={returnTo}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
