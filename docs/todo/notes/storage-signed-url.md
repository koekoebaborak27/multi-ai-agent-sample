# ストレージと署名 URL

Supabase Storage の公開 URL から署名 URL への差し替え方針と、実機確認で判明した落とし穴。
「なぜその設定を選んだか」「どう実行するか」「どこで詰まるか」を、そのままコピペできるコマンド付きで記録している。

> **インフラ構築の手順の正本は [`docs/specs/99_infra/READ_ME_INFRA.md`](../../specs/99_infra/READ_ME_INFRA.md) に移した。**
> 新規に本番環境を構築する場合はそちらを見ること。ここに残しているのは**このプロジェクトを構築したときの実測値と経緯**（手順書に載せきれない測定値・判断の背景・当時の応答内容）である。

全分類の索引は [`README.md`](README.md)、残タスクの一覧は [`TODO.md`](../TODO.md)、作業の経緯は [`history/`](../history/README.md) を見ること。

## 目次

| 時期 | 節 | 内容 |
|---|---|---|
| 2026-08-02 | [署名 URL への差し替え方針](#署名-url-への差し替え方針) | 確定した API 仕様・インターフェース・実機確認の結果と落とし穴 |

## 2026-08-02 署名 URL へ差し替える

### 署名 URL への差し替え方針

**2026-08-02 に実装・実機確認まで完了した**（PR #7 / `main` = `3e8487f`）。以下は実装後の確定情報であり、実測値で上書き済み。

private バケットに対して公開 URL（`/object/public/...`）が HTTP 400 で拒否されることは 2026-08-02 の疎通確認で実測済み（→ [履歴](../history/2026-08-w1.md#2026-08-02-本番-db-の構築と-storage-の疎通確認) の 3 番目の項目）。**バケットを public にする案は、契約書類を扱う以上採らない。**

**Supabase の署名 URL API**（`@supabase/supabase-js` に依存しない REST 直叩き）:

| 項目 | 内容 |
|---|---|
| エンドポイント | `POST {SUPABASE_URL}/storage/v1/object/sign/{bucket}/{path}` |
| リクエストボディ | `{"expiresIn": <秒>}`（JSON） |
| 認証 | 既存実装と同じく `Authorization` + **`apikey` の併送**（→ [Supabase の API キー形式](supabase.md#supabase-の-api-キー形式)） |
| 応答 | `{"signedURL":"/object/sign/{bucket}/{path}?token=..."}`。**`/storage/v1` を含まない相対パス**が返るため、`{SUPABASE_URL}/storage/v1` を前置して完全な URL にする |

**確定したインターフェース**（[`types.ts`](../../../src/shared/storage/types.ts)）:

```ts
getSignedUrl(path: string, expiresInSeconds?: number): Promise<string>;
```

| ファイル | 実際の変更 |
|---|---|
| [`types.ts`](../../../src/shared/storage/types.ts) | `getPublicUrl(path): string`（同期）を上記へ置換。既定値 `DEFAULT_SIGNED_URL_EXPIRES_IN_SECONDS = 60` もここに置いた |
| [`supabase.ts`](../../../src/shared/storage/supabase.ts) | `/object/sign/` を叩き、応答の相対パスに `{SUPABASE_URL}/storage/v1` を前置して返す。失敗時は `AppError("STORAGE_SIGNED_URL_FAILED", 502)` |
| [`local.ts`](../../../src/shared/storage/local.ts) | 従来どおり `/uploads/{path}` を返す（`async` 化のみ。第 2 引数は無視される） |
| [`supabase.test.ts`](../../../src/shared/storage/supabase.test.ts) | `getPublicUrl` のテストを `getSignedUrl` の 8 件へ差し替え（テスト総数 19 → 26） |

**有効期限は短くする。** 署名 URL は「発行したら URL を知る誰でも開ける」ため、画面表示のたびに発行し直す前提で既定 60 秒にした。長くすると、リンクが共有・ログ記録された場合の露出時間がそのまま延びる。

**実機確認の手順**（本番バケットに対して 2026-08-02 に実施）。[Supabase の API キー形式](supabase.md#supabase-の-api-キー形式) にある tsx 直接実行と同じ要領で、使い捨てスクリプトを `uploads/`（`.gitignore` 済み）に置いて実行し、確認後に削除する。

```powershell
pnpm exec tsx --conditions=react-server --env-file=.env uploads/<スクリプト>.ts
```

スクリプトは `supabaseStorage` を直接 import すれば `STORAGE_TYPE` の切り替えは不要。確認した 4 点と実測結果:

| # | 確認内容 | 実測 |
|---|---|---|
| 1 | `upload` | 成功 |
| 2 | 発行した署名 URL を**認証ヘッダなしで** `fetch` | **200・内容一致**（ブラウザで開くのと同条件） |
| 3 | `expiresIn: 1` で発行 → 3 秒後に取得 | **400** `{"error":"InvalidJWT","message":"\"exp\" claim timestamp check failed"}` |
| 4 | 同じパスの公開 URL（署名なし） | **400** `{"error":"Bucket not found","code":"NoSuchBucket"}`（private のままであることの再確認） |

**判明した落とし穴**: **存在しないオブジェクトに対する署名 URL 発行は HTTP 400 で失敗する**（削除済みのパスを渡して確認）。実装は `AppError("STORAGE_SIGNED_URL_FAILED", 502)` を投げるため、**画面側で「ファイルが無い」と「Supabase 側の障害」を区別したい場合は、呼び出す前に存在確認するか code の細分化が要る**。既存の `download` も 404 相当を 502 として扱っており、挙動としては一貫している。

**呼び出し元がゼロのうちに変えられた。** ファイル配信画面を作った後にインターフェースを変えると呼び出し元すべてを追うことになるため、Cloud Run より前に置いた（→ [残作業の順序を確定する](../history/2026-08-w1.md#2026-08-02-残作業の順序を確定する)）。実際、変更は `src/shared/storage/` の 4 ファイルと `README.md` だけで閉じた。

