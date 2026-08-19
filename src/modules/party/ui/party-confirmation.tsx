import Link from "next/link";
import type { PartyFormState } from "@/modules/party/actions";
import { Button } from "@/shared/ui/button";

interface PartyConfirmationProps {
  state: PartyFormState;
  companyTypeLabel: string;
  pending: boolean;
  formAction: (formData: FormData) => void;
  onEdit: () => void;
}

// 更新のとき、変更前と同じ値の項目に添える文言
const UNCHANGED_SUFFIX = "（変更なし）";
const UNSET_LABEL = "未設定";

// 保存前に入力内容を確認してもらう画面（PTY-03）。新規登録・更新の両方で使う。
// 更新のときは変更前と変更後を並べて表示し、値が変わっていない項目には「（変更なし）」を添える（§11.2.1）。
export function PartyConfirmation({
  state,
  companyTypeLabel,
  pending,
  formAction,
  onEdit,
}: PartyConfirmationProps) {
  const isUpdate = state.mode === "update";
  // キャンセルの戻り先。更新なら元の詳細画面、新規登録ならもともと居た一覧画面に戻す
  const cancelHref = isUpdate ? `/parties/${state.id}` : state.returnTo;
  const nameUnchanged = isUpdate && state.originalName === state.name;
  const companyTypeUnchanged =
    isUpdate && state.originalCompanyTypeMasterId === state.companyTypeMasterId;
  const contactInfoUnchanged =
    isUpdate && (state.originalContactInfo ?? "") === (state.contactInfo ?? "");

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
            <dt className="text-sm font-medium text-muted-foreground">現在の名称</dt>
            <dd className="text-sm break-words">{state.originalName}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の名称" : "登録後の名称"}
        </dt>
        <dd className="text-sm break-words">
          {state.name}
          {nameUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の分類</dt>
            <dd className="text-sm break-words">{state.originalCompanyTypeLabel ?? UNSET_LABEL}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の分類" : "登録後の分類"}
        </dt>
        <dd className="text-sm break-words">
          {companyTypeLabel}
          {companyTypeUnchanged ? UNCHANGED_SUFFIX : ""}
        </dd>

        {isUpdate ? (
          <>
            <dt className="text-sm font-medium text-muted-foreground">現在の連絡先</dt>
            <dd className="text-sm break-words">{state.originalContactInfo || "-"}</dd>
          </>
        ) : null}
        <dt className="text-sm font-medium text-muted-foreground">
          {isUpdate ? "更新後の連絡先" : "登録後の連絡先"}
        </dt>
        <dd className="text-sm break-words">
          {state.contactInfo || "-"}
          {contactInfoUnchanged ? UNCHANGED_SUFFIX : ""}
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
          <input type="hidden" name="name" value={state.name ?? ""} />
          <input type="hidden" name="companyTypeMasterId" value={state.companyTypeMasterId ?? ""} />
          <input type="hidden" name="contactInfo" value={state.contactInfo ?? ""} />
          <input type="hidden" name="returnTo" value={state.returnTo} />
          {isUpdate ? (
            <>
              <input type="hidden" name="id" value={state.id} />
              <input type="hidden" name="updatedAt" value={state.updatedAt} />
              <input type="hidden" name="originalName" value={state.originalName} />
              <input
                type="hidden"
                name="originalCompanyTypeMasterId"
                value={state.originalCompanyTypeMasterId ?? ""}
              />
              <input
                type="hidden"
                name="originalCompanyTypeLabel"
                value={state.originalCompanyTypeLabel ?? ""}
              />
              <input
                type="hidden"
                name="originalContactInfo"
                value={state.originalContactInfo ?? ""}
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
