import Link from "next/link";
import { Button } from "@/shared/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-bold">404</h1>
      <p className="text-sm text-muted-foreground">お探しのページは見つかりませんでした。</p>
      <Button asChild>
        <Link href="/">ダッシュボードへ</Link>
      </Button>
    </main>
  );
}
