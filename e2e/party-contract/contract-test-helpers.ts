import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/** 契約画面のE2Eテストが共有して使うデータベース接続。 */
export const prisma = new PrismaClient();

/** ログイン画面を通じて指定した権限のセッションを作る。 */
export async function login(
  page: Page,
  id = "admin",
  password = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123",
) {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill(id);
  await page.getByRole("textbox", { name: "パスワード" }).fill(password);
  await page.getByRole("button", { name: "ログイン" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
}

/** 指定した証跡用フォルダを作り、ファイルの完全パスを返す。 */
export function evidenceDirectory(specName: string) {
  const directory = path.join(
    process.cwd(),
    "docs/test/unit/result/party-contract",
    `テスト結果${specName}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  return (name: string) => path.join(directory, name);
}

/** 契約先コンボボックスから表示名で契約先を選ぶ。 */
export async function selectParty(page: Page, name: string) {
  await page.getByRole("combobox", { name: "契約先" }).click();
  await page.getByRole("option", { name, exact: true }).click();
}

/** Radix UIの選択欄から表示名で値を選ぶ。 */
export async function selectOption(page: Page, name: string, label: "状態" | "契約分類") {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name, exact: true }).click();
}
