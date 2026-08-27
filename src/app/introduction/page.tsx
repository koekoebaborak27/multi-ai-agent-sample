import type { Metadata } from "next";
import Image from "next/image";

export const metadata: Metadata = {
  title: "システム紹介 | サンプル契約管理システム",
  description: "再利用できるシステムテンプレートとAIエージェント共通の開発基盤を紹介します。",
};

// 画面幅に合った紹介画像を表示する。
// スマートフォンでは縦配置に組み直した画像を使い、パソコンでは情報を横に並べた画像を使う。
export default function IntroductionPage() {
  return (
    <main className="min-h-screen bg-background">
      <h1 className="sr-only">システム紹介</h1>
      <p className="sr-only">
        再利用できる業務システムのテンプレートと、複数のAIエージェントで共通利用できる開発基盤を紹介します。
      </p>
      <div className="mx-auto w-full max-w-3xl">
        <picture>
          <source media="(max-width: 767px)" srcSet="/images/about/lp-design-static-mobile.png" />
          <Image
            src="/images/about/lp-design-static.png"
            alt="Agent Ready Templateのシステム紹介"
            width={722}
            height={2179}
            sizes="(max-width: 767px) 100vw, 768px"
            className="h-auto w-full"
          />
        </picture>
      </div>
    </main>
  );
}
