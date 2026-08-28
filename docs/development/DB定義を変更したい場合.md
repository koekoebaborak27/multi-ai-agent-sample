# DB定義を変更したい場合

`prisma/schema.prisma`（テーブル定義）を変更するときの、マイグレーション作成からドキュメント更新までの一連の流れです。マイグレーションの作り方そのものの詳しい手順は [`docs/prisma_operations.md`](../prisma_operations.md) が正本なので、この文書では触れません。

## 全体の流れ

1. `schema.prisma` を編集し、マイグレーションを作ってローカルDBへ適用する
2. 変更したテーブルが属する機能の基本設計書を更新する（該当する場合）
3. データベース仕様書（`db_spec.md`）のテーブル一覧・モデル定義を更新する
4. ER図（`.mmd`）を更新し、SVGを再生成する
5. まとめてコミットする

## 1. schema.prismaを編集し、マイグレーションを作る

[`docs/prisma_operations.md`](../prisma_operations.md)の手順に従う。命名規約は [`prisma/AGENTS.md`](../../prisma/AGENTS.md)。

## 2. 機能の基本設計書を更新する（該当する場合）

- 既存機能（マスタ・契約先契約管理・お知らせ・パスワードリセット等）のテーブルを変更した場合、その機能の `docs/specs/02_basic-design/<機能>/01_データベース.md`（Prismaモデル定義・制約等）を最新化する。
- 新しい機能でテーブルを新設した場合、その機能の基本設計書に `01_データベース.md` を新設する（[`master/01_データベース.md`](../specs/02_basic-design/master/01_データベース.md) 等、既存のものを参考にする）。
- `User` / `ContractItem` のように、専用の基本設計書を持たないテーブルを変更した場合は、`db_spec.md` 側の該当セクション（§98.3・§98.4等）を直接更新する。

## 3. db_spec.mdのテーブル一覧・モデル定義を更新する

[`docs/specs/98_db/db_spec.md`](../specs/98_db/db_spec.md) を開き、次を確認・更新する。

- テーブルを追加・削除した場合、「98.2 テーブル一覧」の表に行を追加・削除する。
- カラムを追加・変更した場合、モデル定義を `db_spec.md` 本体に書いているテーブル（`User` / `ContractItem`）はそこを直接書き換える。それ以外は各機能の `01_データベース.md` へのリンクになっているので、リンク先（手順2）を更新すれば足りる。

## 4. ER図を更新する

[`docs/specs/98_db/db_spec.01.mmd`](../specs/98_db/db_spec.01.mmd) は `schema.prisma` から自動生成されるものではなく、**手で書き換える**必要がある。

1. `.mmd` をスキーマの変更に合わせて書き換える。
   - テーブルを追加した場合: `erDiagram` ブロックに新しいエンティティを追加する。
   - カラムを追加・変更した場合: 該当エンティティのフィールド一覧を書き換える。
   - リレーションを追加した場合: **実際に外部キー制約があるものだけ**を `||--o{` 等の関連線で結ぶ。`createdBy` 等のFKを張らない参照は関連線に含めず、`db_spec.md` 本文（§98.5）に注記する。
2. SVGを再生成する（プロジェクトのルートフォルダで実行。要Docker Desktop起動）:

   ```powershell
   docker run --rm -v ${PWD}:/data minlag/mermaid-cli:11.12.0 -i docs/specs/98_db/db_spec.01.mmd -o docs/specs/98_db/db_spec.01.svg
   ```

3. 生成された `db_spec.01.svg` を開き、日本語が切れていないか・関連線が正しく繋がっているかを確認する。

図の命名規約・変換コマンドの詳細は [`docs/diagrams.md`](../diagrams.md) を参照。

## 5. コミットする

`prisma/schema.prisma` / `prisma/migrations/**`（手順1）と、更新したドキュメント（手順2〜4）は同じPRに含める。スキーマ変更を含むPRである旨をPRの説明に明記する（[`prisma/AGENTS.md`](../../prisma/AGENTS.md)）。
