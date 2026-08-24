-- テーブル名をリネームする（本番の既存データの行を保持したまま Announcement → News へ移行する。DROP TABLE + CREATE TABLE は使わない）
ALTER TABLE "Announcement" RENAME TO "News";
ALTER TABLE "News" RENAME CONSTRAINT "Announcement_pkey" TO "News_pkey";

-- 物理削除方針への変更に伴い、これまで論理削除（deleted = true）されていたお知らせを物理削除する
DELETE FROM "News" WHERE "deleted" = true;

-- AlterTable
ALTER TABLE "News" ADD COLUMN     "category" TEXT;
ALTER TABLE "News" ADD COLUMN     "startAt" TIMESTAMP(3);
ALTER TABLE "News" ADD COLUMN     "endAt" TIMESTAMP(3);
ALTER TABLE "News" ADD COLUMN     "createdBy" TEXT;
ALTER TABLE "News" ADD COLUMN     "updatedBy" TEXT;

-- 既存のお知らせ（カテゴリという概念がまだ無かったもの）は、3区分のうち汎用的な「お知らせ」扱いとする
UPDATE "News" SET "category" = 'NEWS' WHERE "category" IS NULL;

-- 仮の値を割り当てたので必須化する
ALTER TABLE "News" ALTER COLUMN "category" SET NOT NULL;

-- タイトル・本文の最大文字数を仕様どおりに設定する
ALTER TABLE "News" ALTER COLUMN "title" TYPE VARCHAR(200);
ALTER TABLE "News" ALTER COLUMN "body" TYPE VARCHAR(3000);

-- 物理削除方針へ変更したため、論理削除フラグは不要
ALTER TABLE "News" DROP COLUMN "deleted";

-- CreateIndex
CREATE INDEX "News_category_startAt_idx" ON "News"("category", "startAt");
