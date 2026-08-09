"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateMasterCategoryAction, type MasterCategoryFormState } from "@/modules/master/actions";
import { MasterCategoryConfirmation } from "@/modules/master/ui/master-category-confirmation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

interface MasterCategoryUpdateFormProps {
  category: {
    id: number;
    code: string;
    name: string;
    masterCount: number;
    updatedAt: string;
  };
}

export function MasterCategoryUpdateForm({ category }: MasterCategoryUpdateFormProps) {
  const initialState: MasterCategoryFormState = {
    mode: "update",
    phase: "input",
    categoryId: category.id,
    code: category.code,
    originalName: category.name,
    name: category.name,
    masterCount: category.masterCount,
    updatedAt: category.updatedAt,
  };
  const [state, formAction, pending] = useActionState(updateMasterCategoryAction, initialState);
  const [editingState, setEditingState] = useState<MasterCategoryFormState | null>(null);

  if (state.phase === "confirm" && editingState !== state) {
    return (
      <MasterCategoryConfirmation
        state={state}
        pending={pending}
        formAction={formAction}
        onEdit={() => setEditingState(state)}
      />
    );
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <input type="hidden" name="originalName" value={state.originalName} />

      <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <dt className="text-sm font-medium text-muted-foreground">マスタ分類コード</dt>
        <dd className="font-mono text-sm">{category.code}</dd>
        <dt className="text-sm font-medium text-muted-foreground">登録マスタ件数</dt>
        <dd className="text-sm tabular-nums">{category.masterCount}件</dd>
      </dl>

      <div className="space-y-2">
        <Label htmlFor="name">マスタ分類名</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.name ?? category.name}
          required
          aria-describedby="name-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="name-help" className="text-sm text-muted-foreground">
          1文字以上30文字以内で入力してください。前後の空白は更新時に除去されます。
        </p>
      </div>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="intent" value="confirm" disabled={pending}>
          {pending ? "確認中..." : "確認する"}
        </Button>
        <Button asChild variant="outline">
          <Link href={`/master/categories/${category.id}`}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
