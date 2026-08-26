import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { expect, type Locator, type Page } from "@playwright/test";

/** お知らせ画面のテストで使うPrisma Client。テスト終了時に必ず切断する。 */
export const prisma = new PrismaClient();

/** .env.example のPAGE_SIZEと合わせる。さらに表示・ページ送りの境界値に使う。 */
export const NEWS_PAGE_SIZE = 30;

/** 画面操作に使う利用者。パスワードは環境変数からだけ受け取る。 */
export const TEST_USERS = {
  admin: { id: "admin", password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@123" },
  operator: { id: "opeTest", password: process.env.SEED_OPERATOR_PASSWORD ?? "test@123" },
  viewer: { id: "viwTest", password: process.env.SEED_VIEWER_PASSWORD ?? "test@123" },
} as const;

/** テスト単位ごとのエビデンス保存先を作って返す。 */
export function createEvidenceDir(specificationName: string): string {
  const directory = path.join(process.cwd(), "docs/test/unit/result/news", specificationName);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

/** エビデンスのJSONを読みやすい形式で保存する。 */
export function writeEvidenceJson(directory: string, name: string, value: unknown): void {
  fs.writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2));
}

/** 指定利用者でログインし、トップ画面へ到達したことを確認する。 */
export async function login(
  page: Page,
  user: (typeof TEST_USERS)[keyof typeof TEST_USERS],
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(user.id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(user.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

/** 追加取得が必要なトップ画面で、指定したお知らせが見えるまでページを順に読み込む。 */
export async function loadMoreUntilVisible(page: Page, title: string): Promise<void> {
  // 表示は「日時：タイトル」を1つの段落にまとめているため、タイトル単体との完全一致にはならない。
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await page.getByText(title).count()) return;
    const button = page.getByRole("button", { name: "さらに表示" });
    if (!(await button.count())) break;
    await button.click();
  }
  await expect(page.getByText(title)).toBeVisible();
}

/** テスト用のお知らせを作る。名前で限定して後始末できるよう、必ずE2E-NEWS接頭辞を使う。 */
export async function createNews(
  suffix: string,
  overrides: Partial<{
    title: string;
    body: string;
    category: "INCIDENT" | "MAINTENANCE" | "NEWS";
    published: boolean;
    startAt: Date | null;
    endAt: Date | null;
    createdBy: string | null;
    updatedBy: string | null;
  }> = {},
) {
  return prisma.news.create({
    data: {
      title: `E2E-NEWS-${suffix}`,
      body: "画面操作テスト用の本文",
      category: "NEWS",
      published: true,
      // 「今すぐ公開中」をテストの既定値にするため、固定日時ではなく実行時点の現在時刻を使う。
      startAt: new Date(),
      endAt: null,
      createdBy: "admin",
      updatedBy: "admin",
      ...overrides,
    },
  });
}

/** テストが作ったお知らせだけを削除し、既存データには触れない。 */
export async function deleteCreatedNews(): Promise<void> {
  await prisma.news.deleteMany({ where: { title: { startsWith: "E2E-NEWS-" } } });
}

/**
 * 入力欄のmaxLengthを無視して値を設定する。
 * fill()はブラウザのmaxLength属性で自動的に切り詰められてしまい、
 * 上限を超えた入力をサーバー側が拒否することを確認できないため使う。
 */
export async function fillBeyondMaxLength(field: Locator, value: string): Promise<void> {
  await field.evaluate((el, val) => {
    const setter = Object.getOwnPropertyDescriptor(
      el instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value",
    )?.set;
    setter?.call(el, val);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

/** 日時入力欄に渡せる日本時間の文字列へ変換する。 */
export function toDateTimeLocal(value: Date): string {
  return new Date(value.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 16);
}
