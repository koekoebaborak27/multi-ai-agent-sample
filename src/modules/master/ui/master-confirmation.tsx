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

// 更新のとき、変更前と同じ値の項目に添える文言
const UNCHANGED_SUFFIX = "（変更なし）";

// 保存前に入力内容を確認してもらう画面。新規登録と更新の両方で使う。
// 更新のときは変更前と変更後を並べて表示し、値が変わっていない項目には「（変更なし）」を添える。
export function MasterConfirmation({
  state,
  categoryName,
  pending,
  formAction,
  onEdit,
}: MasterConfirmationProps) {
  const isUpdate = state.mode === "update";
  // キャンセルの戻り先。更新なら元の詳細画面、新規登録ならもともと居た一覧画面に戻す
  const cancelHref = isUpdate ? `/master/${state.masterId}` : state.returnTo;
  const categoryUnchanged = isUpdate && state.originalCategoryId === state.categoryId;
  const codeUnchanged = isUpdate && state.originalCode === state.code;
  const contentUnchanged = isUpdate && state.originalContent === state.content;

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
            <dt className="text-sm font-medium text-muted-foreground">変更前のマスタ分類</dt>
            <dd className="text-sm break-words">{state.originalCategoryName}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "変更後のマスタ分類" : "登録後のマスタ分類"}
        </dt>
        <dd className="text-sm break-words">
          {categoryName}
          {categoryUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">変更前のマスタコード</dt>
            <dd className="font-mono text-sm">{state.originalCode}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "変更後のマスタコード" : "登録後のマスタコード"}
        </dt>
        <dd className="font-mono text-sm">
          {state.code}
          {codeUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">変更前のマスタ内容</dt>
            <dd className="text-sm break-words">{state.originalContent}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "変更後のマスタ内容" : "登録後のマスタ内容"}
        </dt>
        <dd className="text-sm break-words">
          {state.content}
          {contentUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>
      </dl>

      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {/*
          この確認画面には入力欄が無いため、そのまま送信すると入力内容が失われる。
          そこで、確認した内容を見えない項目として持たせ、実行時に改めて送信している。
        */}
        <form action={formAction}>
          <input type="hidden" name="categoryId" value={state.categoryId ?? ""} />
          <input type="hidden" name="code" value={state.code ?? ""} />
          <input type="hidden" name="content" value={state.content ?? ""} />
          <input type="hidden" name="returnTo" value={state.returnTo} />
          {isUpdate ? (
            <>
              <input type="hidden" name="masterId" value={state.masterId} />
              <input type="hidden" name="updatedAt" value={state.updatedAt} />
              <input type="hidden" name="originalCategoryId" value={state.originalCategoryId} />
              <input type="hidden" name="originalCategoryName" value={state.originalCategoryName} />
              <input type="hidden" name="originalCode" value={state.originalCode} />
              <input type="hidden" name="originalContent" value={state.originalContent} />
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
