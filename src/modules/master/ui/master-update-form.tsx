"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { updateMasterAction, type MasterFormState } from "@/modules/master/actions";
import type { MasterCategoryOption } from "@/modules/master/types";
import { MasterConfirmation } from "@/modules/master/ui/master-confirmation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

interface MasterUpdateFormProps {
  master: {
    id: number;
    categoryId: number;
    categoryName: string;
    code: string;
    content: string;
    updatedAt: string;
  };
  categories: MasterCategoryOption[];
  returnTo: string;
}

export function MasterUpdateForm({ master, categories, returnTo }: MasterUpdateFormProps) {
  const initialState: MasterFormState = {
    mode: "update",
    phase: "input",
    masterId: master.id,
    categoryId: master.categoryId,
    code: master.code,
    content: master.content,
    returnTo,
    updatedAt: master.updatedAt,
    originalCategoryId: master.categoryId,
    originalCategoryName: master.categoryName,
    originalCode: master.code,
    originalContent: master.content,
  };
  const [state, formAction, pending] = useActionState(updateMasterAction, initialState);
  const [editingState, setEditingState] = useState<MasterFormState | null>(null);
  const [categoryId, setCategoryId] = useState(String(state.categoryId ?? master.categoryId));

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
      <input type="hidden" name="masterId" value={master.id} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <input type="hidden" name="originalCategoryId" value={state.originalCategoryId} />
      <input type="hidden" name="originalCategoryName" value={state.originalCategoryName} />
      <input type="hidden" name="originalCode" value={state.originalCode} />
      <input type="hidden" name="originalContent" value={state.originalContent} />
      <input type="hidden" name="returnTo" value={returnTo} />

      <p className="text-sm text-muted-foreground">
        マスタコードと所属マスタ分類を変更しても、このマスタを参照している画面の表示先は変わりません。
        <br />
        変更後のマスタコードは、変更後のマスタ分類の中で重複しない値である必要があります。
      </p>

      <div className="space-y-2">
        <Label htmlFor="categoryId">マスタ分類</Label>
        <input type="hidden" name="categoryId" value={categoryId} />
        <Select value={categoryId} onValueChange={setCategoryId}>
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
                {category.code} {category.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="code">マスタコード</Label>
        <Input
          id="code"
          name="code"
          defaultValue={state.code ?? master.code}
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
          defaultValue={state.content ?? master.content}
          required
          aria-describedby="content-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="content-help" className="text-sm text-muted-foreground">
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
          <Link href={`/master/${master.id}`}>キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
