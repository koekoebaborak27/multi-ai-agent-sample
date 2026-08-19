-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "updatedBy" TEXT;

-- AlterTable
ALTER TABLE "Party" ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "updatedBy" TEXT;
