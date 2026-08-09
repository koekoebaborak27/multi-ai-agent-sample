"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createMasterCategoryAction, type MasterCategoryFormState } from "@/modules/master/actions";
import { MasterCategoryConfirmation } from "@/modules/master/ui/master-category-confirmation";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";

const initialState: MasterCategoryFormState = { mode: "create", phase: "input" };

export function MasterCategoryCreateForm() {
  const [state, formAction, pending] = useActionState(createMasterCategoryAction, initialState);
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
