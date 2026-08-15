import { Button } from "@/shared/ui/button";

interface MasterExportButtonProps {
  /** CSVダウンロードのRoute HandlerのURL（検索条件はクエリパラメータとして呼び出し側で組み立て済み） */
  href: string;
  disabled?: boolean;
  disabledReason?: string;
}

// マスタ一覧（MST-01）・マスタ分類一覧（MST-06）に置く「CSVダウンロード」ボタン。
// クリックすると、appの中でその場でCSVを組み立てて返す窓口へ直接遷移し、ブラウザの通常のダウンロード動作に任せる。
export function MasterExportButton({ href, disabled, disabledReason }: MasterExportButtonProps) {
  return (
    <div className="flex flex-col items-end gap-1">
      {disabled ? (
        <Button variant="outline" disabled>
          CSVダウンロード
        </Button>
      ) : (
        <Button variant="outline" asChild>
          <a href={href}>CSVダウンロード</a>
        </Button>
      )}
      {disabled && disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
