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
    <main className="min-h-screen overflow-hidden bg-slate-100">
      <h1 className="sr-only">システム紹介</h1>
      <p className="sr-only">
        再利用できる業務システムのテンプレートと、複数のAIエージェントで共通利用できる開発基盤を紹介します。
      </p>
      <section className="bg-white md:flex md:min-h-screen md:items-center md:justify-center md:bg-slate-100 md:px-8 md:py-6">
        <div className="w-full md:max-w-6xl">
          <picture className="block">
            <source
              media="(max-width: 767px)"
              srcSet="/images/about/lp-design-static-mobile-01.png"
            />
            <Image
              src="/images/about/lp-design-static-desktop-01.png"
              alt="Agent Ready Templateの概要と2つのテーマ"
              width={1536}
              height={1024}
              sizes="(max-width: 767px) 100vw, 1152px"
              className="mx-auto h-auto w-full md:w-[min(72rem,calc(100vw-4rem),calc(150svh-4.5rem))] md:max-w-none md:rounded-2xl md:shadow-sm md:ring-1 md:ring-slate-200"
              priority
            />
          </picture>
        </div>
      </section>
      <div className="bg-white md:hidden">
        <div className="mx-4 h-px bg-slate-300" aria-hidden="true" />
        <section className="py-4">
          <Image
            src="/images/about/lp-design-static-mobile-02.png"
            alt="再利用できる土台とAIエージェント共通の開発ルール"
            width={864}
            height={1821}
            sizes="100vw"
            className="h-auto w-full"
          />
        </section>
        <div className="mx-4 h-px bg-slate-300" aria-hidden="true" />
        <section className="py-4">
          <Image
            src="/images/about/lp-design-static-mobile-03.png"
            alt="契約管理の実装サンプルと人とAIエージェントの作業手順"
            width={864}
            height={1821}
            sizes="100vw"
            className="h-auto w-full"
          />
        </section>
        <div className="mx-4 h-px bg-slate-300" aria-hidden="true" />
        <section className="py-4">
          <Image
            src="/images/about/lp-design-static-mobile-04.png"
            alt="品質確認の流れと開発基盤のまとめ"
            width={862}
            height={1825}
            sizes="100vw"
            className="h-auto w-full"
          />
        </section>
      </div>
      <div className="hidden md:block">
        <section className="flex min-h-screen items-center justify-center border-t border-slate-200 px-8 py-6">
          <Image
            src="/images/about/lp-design-static-desktop-02.png"
            alt="再利用できる土台とAIエージェント共通の開発ルール"
            width={1536}
            height={1024}
            sizes="1152px"
            className="h-auto w-[min(72rem,calc(100vw-4rem),calc(150svh-4.5rem))] max-w-none rounded-2xl shadow-sm ring-1 ring-slate-200"
          />
        </section>
        <section className="flex min-h-screen items-center justify-center border-t border-slate-200 px-8 py-6">
          <Image
            src="/images/about/lp-design-static-desktop-03.png"
            alt="契約管理の実装サンプルと人とAIエージェントの作業手順"
            width={1536}
            height={1024}
            sizes="1152px"
            className="h-auto w-[min(72rem,calc(100vw-4rem),calc(150svh-4.5rem))] max-w-none rounded-2xl shadow-sm ring-1 ring-slate-200"
          />
        </section>
        <section className="flex min-h-screen items-center justify-center border-t border-slate-200 px-8 py-6">
          <Image
            src="/images/about/lp-design-static-desktop-04.png"
            alt="品質確認の流れと開発基盤のまとめ"
            width={1536}
            height={1024}
            sizes="1152px"
            className="h-auto w-[min(72rem,calc(100vw-4rem),calc(150svh-4.5rem))] max-w-none rounded-2xl shadow-sm ring-1 ring-slate-200"
          />
        </section>
      </div>
    </main>
  );
}
