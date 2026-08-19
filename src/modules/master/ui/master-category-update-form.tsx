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

// マスタ分類の更新フォーム。
// 分類名・分類コードの両方を変更できる。登録マスタ件数は参考情報として表示するだけ。
export function MasterCategoryUpdateForm({ category }: MasterCategoryUpdateFormProps) {
  const initialState: MasterCategoryFormState = {
    mode: "update",
    phase: "input",
    categoryId: category.id,
    code: category.code,
    originalCode: category.code,
    originalName: category.name,
    name: category.name,
    masterCount: category.masterCount,
    updatedAt: category.updatedAt,
  };
  const [state, formAction, pending] = useActionState(updateMasterCategoryAction, initialState);
  // 確認画面で「入力内容を修正」が押されたときの状態を覚えておく。
  // 修正を押した時点の状態と現在の状態が同じ間は、入力画面へ戻したままにする。
  const [editingState, setEditingState] = useState<MasterCategoryFormState | null>(null);

  // 確認の段階になったら、入力欄の代わりに確認画面を表示する
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
      {/*
        入力欄として表示しないが処理に必要な値を、見えない項目として一緒に送る。
        updatedAt は他の利用者が先に更新していないかの判断に、
        originalName は確認画面で変更前の名前を表示するために使う。
      */}
      <input type="hidden" name="categoryId" value={category.id} />
      <input type="hidden" name="updatedAt" value={state.updatedAt} />
      <input type="hidden" name="originalName" value={state.originalName} />
      <input type="hidden" name="originalCode" value={state.originalCode ?? category.code} />

      <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
        <dt className="text-sm font-medium text-muted-foreground">登録マスタ件数</dt>
        <dd className="text-sm tabular-nums">{category.masterCount}件</dd>
      </dl>

      <div className="space-y-2">
        <Label htmlFor="code">マスタ分類コード</Label>
        <Input
          id="code"
          name="code"
          defaultValue={state.code ?? category.code}
          required
          maxLength={50}
          className="font-mono"
          aria-describedby="code-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="code-help" className="text-sm text-muted-foreground">
          英大文字・数字・ハイフン・アンダースコアのみ、50文字以内で入力してください。
        </p>
      </div>

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
