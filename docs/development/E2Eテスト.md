# E2Eテスト（Playwright）

ブラウザを実際に操作して画面の動作を確認する自動テストです。[`TESTING.md`](../../TESTING.md)が扱う単体テスト（Vitest）とは別に、[`playwright.config.ts`](../../playwright.config.ts)を設定として使います。`@playwright/test`本体（`package.json`の`devDependencies`）とchromiumブラウザ本体は導入済みです。

> **E2Eテスト（End-to-Endテスト）**とは、ログインして画面を操作し、期待どおりの表示やデータベースの更新が行われるかを、実際のブラウザ操作を通して確認するテストです。関数単位で確認する単体テストと異なり、複数の画面・処理をまたいだ一連の流れを検証します。

## 1. 導入する（初回のみ）

`pnpm install`で`@playwright/test`本体は導入されますが、ブラウザ本体は別途ダウンロードが必要です。まだ実行していない場合は次を実行してください。

```bash
pnpm exec playwright install chromium
```

`playwright.config.ts`は`testDir: "./e2e"`（テストファイルの配置場所）と、`baseURL`（既定`http://localhost:3000`。`E2E_BASE_URL`環境変数で上書き可能）を設定済みです。追加の設定は不要です。

## 2. テスト対象を起動する

DBとアプリを起動します（[`プロジェクトの導入手順.md`](プロジェクトの導入手順.md)のステップ4、または[「Dockerではなくパソコン上で直接動かす」](Dockerではなくパソコン上で直接動かす.md)）。

```bash
docker compose -f docker/docker-compose.yml up -d db
pnpm dev
```

ログインが必要なテストでは、ログインIDとパスワードが必要です。**パスワードはテストコードに直接書かず、環境変数（`.env`）から`process.env.<変数名>`で読み取ってください。** 例えば初期管理者でログインする場合、`.env`に次を追記します（`SEED_ADMIN_PASSWORD`は[`prisma/seed.ts`](../../prisma/seed.ts)が使う変数と同じ名前です）。

```text
SEED_ADMIN_PASSWORD=Admin@123
```

## 3. テストを作成する

`e2e/<画面名>.spec.ts`のようにファイルを作成します。セレクタは`getByRole` / `getByLabel` / `getByText`など、画面上のボタン名・ラベル名で要素を探す書き方を基本とします（`DESIGN.md`の「インタラクティブ要素にはアクセシビリティ属性を付ける」規約と揃えるため）。

```ts
import { test, expect } from "@playwright/test";

test("ログインしてマスタ一覧が表示される", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("ユーザーID").fill("admin");
  await page.getByRole("textbox", { name: "パスワード" }).fill(process.env.SEED_ADMIN_PASSWORD ?? "");
  // ログイン後の遷移先は「/」（トップ画面）であり、対象画面へは別途遷移する
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/"),
    page.getByRole("button", { name: "ログイン" }).click(),
  ]);
  await page.goto("/master");
  await expect(page.getByRole("heading", { name: "マスタ管理" })).toBeVisible();
});
```

> ログイン成功時のリダイレクト先は`/master`などの各画面ではなく`/`（トップ画面）です。クリック直後に対象画面へ`page.goto`する場合は、上記のように`Promise.all`でログインの遷移完了を待ってから行ってください（待たずに`goto`すると未ログイン状態のまま扱われ、`/login`へ戻されます）。

## 4. 手動で実行する

```bash
pnpm exec playwright test e2e/<ファイル名>.spec.ts
```

**`.env`に置いた環境変数（パスワード等）は、上記コマンドだけでは読み込まれません。** Node.js（v20.6以降）の`--env-file`オプションで明示的に読み込んでください。

```bash
node --env-file=.env node_modules/@playwright/test/cli.js test e2e/<ファイル名>.spec.ts
```

既定はヘッドレス実行（ブラウザ画面を表示せずバックグラウンドで動作）です。失敗した場合は次のコマンドで詳細なレポートを開けます。

```bash
pnpm exec playwright show-report
```

## AIエージェントに任せる場合

同じ作業をAIエージェントに依頼する場合は、[`create-unit-test-spec`](../skills/create-unit-test-spec.md)スキルでテスト仕様書を作成してから、[`playwright-evidence-test`](../skills/playwright-evidence-test.md)スキルで実行します。パスワードの安全な扱い方・本番DB/URLへの誤接続防止・スクリーンショットやDB状態の保存規則など、手動実行より詳しい安全ルールが定義されています。
