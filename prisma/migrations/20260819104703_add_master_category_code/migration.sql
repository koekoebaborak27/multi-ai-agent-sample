-- AlterTable
ALTER TABLE "MasterCategory" ADD COLUMN     "code" VARCHAR(50);

-- 既存データ（本番・ローカルとも実運用データなし、テストデータのみ）へ機械的な仮コードを割り当てる。
-- 利用者は登録後に画面から実際の分類コードへ変更できる。
UPDATE "MasterCategory" SET "code" = 'CATEGORY_' || LPAD("id"::text, 4, '0') WHERE "code" IS NULL;

-- 仮コードを割り当てたので NOT NULL 化する
ALTER TABLE "MasterCategory" ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MasterCategory_code_key" ON "MasterCategory"("code");
