"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createMasterCategoryAction, type MasterCategoryFormState } from "@/modules/master/actions";
import { MasterCategoryConfirmation } from "@/modules/master/ui/master-category-confirmation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: MasterCategoryFormState = { mode: "create", phase: "input" };

// マスタ分類の新規登録フォーム。
// 「確認する」を押すと同じ画面が確認表示へ切り替わり、そこで「実行」を押すと登録される。
export function MasterCategoryCreateForm() {
  const [state, formAction, pending] = useActionState(createMasterCategoryAction, initialState);
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
      <div className="space-y-2">
        <Label htmlFor="name">マスタ分類名</Label>
        <Input
          id="name"
          name="name"
          defaultValue={state.name ?? ""}
          required
          aria-describedby="name-help"
          aria-invalid={state.error ? true : undefined}
        />
        <p id="name-help" className="text-sm text-muted-foreground">
          1文字以上30文字以内で入力してください。前後の空白は登録時に除去されます。
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
          <Link href="/master/categories">キャンセル</Link>
        </Button>
      </div>
    </form>
  );
}
