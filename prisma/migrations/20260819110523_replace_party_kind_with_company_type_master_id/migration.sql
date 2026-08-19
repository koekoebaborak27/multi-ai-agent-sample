/*
  Warnings:

  - You are about to drop the column `kind` on the `Party` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Party" DROP COLUMN "kind",
ADD COLUMN     "companyTypeMasterId" INTEGER;
