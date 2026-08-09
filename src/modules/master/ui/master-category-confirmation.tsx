import Link from "next/link";
import type { MasterCategoryFormState } from "@/modules/master/actions";
import { Button } from "@/shared/ui/button";

interface MasterCategoryConfirmationProps {
  state: MasterCategoryFormState;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
}

export function MasterCategoryConfirmation({
  state,
  pending,
  formAction,
  onEdit,
}: MasterCategoryConfirmationProps) {
  const name = state.name ?? "";
  const isUpdate = state.mode === "update";
  const cancelHref = isUpdate ? `/master/categories/${state.categoryId}` : "/master/categories";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">入力内容の確認</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          内容を確認して「実行」を押してください。
        </p>
      </div>

      <dl className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-[12rem_1fr]">
        <dt className="text-sm font-medium text-muted-foreground">処理内容</dt>
        <dd className="text-sm">{isUpdate ? "更新" : "新規登録"}</dd>
        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">マスタ分類コード</dt>
            <dd className="font-mono text-sm">{state.code}</dd>
            <dt className="text-sm font-medium text-muted-foreground">現在のマスタ分類名</dt>
            <dd className="text-sm break-words">{state.originalName}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後のマスタ分類名" : "登録後のマスタ分類名"}
        </dt>
        <dd className="text-sm break-words">{name}</dd>
        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">登録マスタ件数</dt>
            <dd className="text-sm tabular-nums">{state.masterCount}件</dd>
          </>
        ) : null}
      </dl>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="name" value={name} />
          {isUpdate ? (
            <>
              <input type="hidden" name="categoryId" value={state.categoryId} />
              <input type="hidden" name="updatedAt" value={state.updatedAt} />
              <input type="hidden" name="originalName" value={state.originalName} />
            </>
          ) : null}
          <Button type="submit" name="intent" value="execute" disabled={pending}>
            {pending ? (isUpdate ? "更新中..." : "登録中...") : "実行"}
          </Button>
        </form>
        <Button type="button" variant="outline" onClick={onEdit} disabled={pending}>
          入力内容を修正
        </Button>
        <Button asChild variant="outline">
          <Link href={cancelHref}>キャンセル</Link>
        </Button>
      </div>
    </div>
  );
}
