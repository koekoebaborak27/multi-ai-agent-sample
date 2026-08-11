import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

/**
 * まだ作っていない機能の画面に置く、仮の表示。
 * メニューから開いたときに何も出ないと不具合に見えるため、準備中であることを伝える。
 */
export function FeaturePlaceholder({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      <Card>
        <CardHeader>
          <CardTitle>準備中</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">この機能は後続スコープで実装します。</p>
        </CardContent>
      </Card>
    </div>
  );
}
