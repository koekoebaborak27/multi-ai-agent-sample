import Link from "next/link";
import type { ContractFormState } from "@/modules/contract/actions";
import { CONTRACT_STATUS_LABELS } from "@/modules/contract/types";
import { Button } from "@/shared/ui/button";

interface ContractConfirmationProps {
  state: ContractFormState;
  categoryLabel: string;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
}

// 更新のとき、変更前と同じ値の項目に添える文言
const UNCHANGED_SUFFIX = "（変更なし）";
const UNSET_LABEL = "未設定";
const UNDECIDED_LABEL = "未定";

/** 開始日・終了日の組を「開始日 〜 終了日」の形の文字列にする。未入力の場合は「未定」を表示する */
function formatPeriod(startDate: string | undefined, endDate: string | undefined): string {
  return `${startDate || UNDECIDED_LABEL} 〜 ${endDate || UNDECIDED_LABEL}`;
}

// 保存前に入力内容を確認してもらう画面（CTR-03）。新規登録・更新の両方で使う。
// 更新のときは変更前と変更後を並べて表示し、値が変わっていない項目には「（変更なし）」を添える（§21.2.1）。
// 契約先は新規登録時に決めたら以後変更できないため、更新モードでも対比を行わず現在の契約先名称のみ表示する。
export function ContractConfirmation({
  state,
  categoryLabel,
  pending,
  formAction,
  onEdit,
}: ContractConfirmationProps) {
  const isUpdate = state.mode === "update";
  // キャンセルの戻り先。更新なら元の詳細画面、新規登録ならもともと居た一覧画面に戻す
  const cancelHref = isUpdate ? `/contracts/${state.id}` : state.returnTo;
  const titleUnchanged = isUpdate && state.originalTitle === state.title;
  const periodUnchanged =
    isUpdate &&
    (state.originalStartDate ?? "") === (state.startDate ?? "") &&
    (state.originalEndDate ?? "") === (state.endDate ?? "");
  const statusUnchanged = isUpdate && state.originalStatus === state.status;
  const categoryUnchanged = isUpdate && state.originalCategoryMasterId === state.categoryMasterId;

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

        <dt className="text-sm font-medium text-muted-foreground">契約先</dt>
        <dd className="text-sm break-words">{state.partyName}</dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の契約名</dt>
            <dd className="text-sm break-words">{state.originalTitle}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の契約名" : "登録後の契約名"}
        </dt>
        <dd className="text-sm break-words">
          {state.title}
          {titleUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の開始日・終了日</dt>
            <dd className="text-sm break-words">
              {formatPeriod(state.originalStartDate, state.originalEndDate)}
            </dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の開始日・終了日" : "登録後の開始日・終了日"}
        </dt>
        <dd className="text-sm break-words">
          {formatPeriod(state.startDate, state.endDate)}
          {periodUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の状態</dt>
            <dd className="text-sm break-words">
              {state.originalStatus ? CONTRACT_STATUS_LABELS[state.originalStatus] : ""}
            </dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の状態" : "登録後の状態"}
        </dt>
        <dd className="text-sm break-words">
          {state.status ? CONTRACT_STATUS_LABELS[state.status] : ""}
          {statusUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の契約分類</dt>
            <dd className="text-sm break-words">{state.originalCategoryLabel ?? UNSET_LABEL}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の契約分類" : "登録後の契約分類"}
        </dt>
        <dd className="text-sm break-words">
          {categoryLabel}
          {categoryUnchanged ? UNCHANGED_SUFFIX : ""}
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
          <input type="hidden" name="partyId" value={state.partyId ?? ""} />
          <input type="hidden" name="title" value={state.title ?? ""} />
          <input type="hidden" name="startDate" value={state.startDate ?? ""} />
          <input type="hidden" name="endDate" value={state.endDate ?? ""} />
          <input type="hidden" name="status" value={state.status ?? ""} />
          <input type="hidden" name="categoryMasterId" value={state.categoryMasterId ?? ""} />
          <input type="hidden" name="returnTo" value={state.returnTo} />
          {isUpdate ? (
            <>
              <input type="hidden" name="id" value={state.id} />
              <input type="hidden" name="updatedAt" value={state.updatedAt} />
              <input type="hidden" name="originalTitle" value={state.originalTitle} />
              <input type="hidden" name="originalStartDate" value={state.originalStartDate ?? ""} />
              <input type="hidden" name="originalEndDate" value={state.originalEndDate ?? ""} />
              <input type="hidden" name="originalStatus" value={state.originalStatus} />
              <input
                type="hidden"
                name="originalCategoryMasterId"
                value={state.originalCategoryMasterId ?? ""}
              />
              <input
                type="hidden"
                name="originalCategoryLabel"
                value={state.originalCategoryLabel ?? ""}
              />
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
