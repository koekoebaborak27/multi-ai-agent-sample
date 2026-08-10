import Link from "next/link";
import type { MasterFormState } from "@/modules/master/actions";
import { Button } from "@/shared/ui/button";

interface MasterConfirmationProps {
  state: MasterFormState;
  categoryName: string;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
}

export function MasterConfirmation({
  state,
  categoryName,
  pending,
  formAction,
  onEdit,
}: MasterConfirmationProps) {
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
        <dd className="text-sm">新規登録</dd>
        <dt className="text-sm font-medium text-muted-foreground">登録後のマスタ分類</dt>
        <dd className="text-sm break-words">{categoryName}</dd>
        <dt className="text-sm font-medium text-muted-foreground">登録後のマスタコード</dt>
        <dd className="font-mono text-sm">{state.code}</dd>
        <dt className="text-sm font-medium text-muted-foreground">登録後のマスタ内容</dt>
        <dd className="text-sm break-words">{state.content}</dd>
      </dl>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <form action={formAction}>
          <input type="hidden" name="categoryId" value={state.categoryId ?? ""} />
          <input type="hidden" name="code" value={state.code ?? ""} />
          <input type="hidden" name="content" value={state.content ?? ""} />
          <input type="hidden" name="returnTo" value={state.returnTo} />
          <Button type="submit" name="intent" value="execute" disabled={pending}>
            {pending ? "登録中..." : "実行"}
          </Button>
        </form>
        <Button type="button" variant="outline" onClick={onEdit} disabled={pending}>
          入力内容を修正
        </Button>
        <Button asChild variant="outline">
          <Link href={state.returnTo}>キャンセル</Link>
        </Button>
      </div>
    </div>
  );
}
