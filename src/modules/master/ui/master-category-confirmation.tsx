import Link from "next/link";
import type { MasterCategoryFormState } from "@/modules/master/actions";
import { MasterCategoryCautionDialog } from "@/modules/master/ui/master-category-caution-dialog";
import { Button } from "@/shared/ui/button";
import { DialogClose, DialogFooter } from "@/shared/ui/dialog";

interface MasterCategoryConfirmationProps {
  state: MasterCategoryFormState;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
}

// マスタ分類を保存する前に、入力内容を確認してもらう画面。新規登録と更新の両方で使う。
// 更新のときは、変更前の名前・分類コード・登録マスタ件数も一緒に表示する。
export function MasterCategoryConfirmation({
  state,
  pending,
  formAction,
  onEdit,
}: MasterCategoryConfirmationProps) {
  const code = state.code ?? "";
  const name = state.name ?? "";
  const isUpdate = state.mode === "update";
  const codeChanged = isUpdate && code !== state.originalCode;
  // キャンセルの戻り先。更新なら元の詳細画面、新規登録なら分類一覧に戻す
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
            <dt className="text-sm font-medium text-muted-foreground">現在のマスタ分類コード</dt>
            <dd className="font-mono text-sm">{state.originalCode}</dd>
            <dt className="text-sm font-medium text-muted-foreground">現在のマスタ分類名</dt>
            <dd className="text-sm break-words">{state.originalName}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後のマスタ分類コード" : "登録後のマスタ分類コード"}
        </dt>
        <dd className="font-mono text-sm">
          {code}
          {isUpdate && !codeChanged ? "（変更なし）" : ""}
        </dd>
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

      {/*
        更新モードのエラーは、実行ボタンの警告確認ダイアログの中で表示する（下記）。
        新規登録モードにはダイアログが無いため、ここに表示する。
      */}
      {!isUpdate && state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {/*
          この確認画面には入力欄が無いため、そのまま送信すると入力内容が失われる。
          そこで、確認した内容を見えない項目として持たせ、実行時に改めて送信している。
        */}
        {isUpdate ? (
          // 更新モードは、契約先・契約モジュールがマスタ分類コードを参照している可能性があるため、
          // 実行前に警告確認ダイアログを挟む（§00.5.1）。フォームはダイアログの中に置き、
          // ダイアログ内の「OK」を押したときだけServer Actionを呼び出す。
          <MasterCategoryCautionDialog
            trigger={
              <Button type="button" disabled={pending}>
                {pending ? "更新中..." : "実行"}
              </Button>
            }
            title="マスタ分類を更新しますか？"
            code={code}
            name={name}
            pending={pending}
          >
            {(cancelButtonRef) => (
              <form action={formAction} className="space-y-4">
                <input type="hidden" name="code" value={code} />
                <input type="hidden" name="name" value={name} />
                <input type="hidden" name="categoryId" value={state.categoryId} />
                <input type="hidden" name="updatedAt" value={state.updatedAt} />
                <input type="hidden" name="originalName" value={state.originalName} />
                {state.error ? (
                  <p role="alert" className="text-sm text-destructive">
                    {state.error}
                  </p>
                ) : null}
                <DialogFooter>
                  <DialogClose asChild>
                    <Button
                      ref={cancelButtonRef}
                      type="button"
                      variant="outline"
                      disabled={pending}
                    >
                      キャンセル
                    </Button>
                  </DialogClose>
                  <Button type="submit" name="intent" value="execute" disabled={pending}>
                    {pending ? "更新中..." : "OK"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </MasterCategoryCautionDialog>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="code" value={code} />
            <input type="hidden" name="name" value={name} />
            <Button type="submit" name="intent" value="execute" disabled={pending}>
              {pending ? "登録中..." : "実行"}
            </Button>
          </form>
        )}
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
