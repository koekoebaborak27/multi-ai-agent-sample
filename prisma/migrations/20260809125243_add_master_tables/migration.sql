-- CreateTable
CREATE TABLE "MasterCategory" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "MasterCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Master" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "content" VARCHAR(30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Master_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MasterCategory_name_key" ON "MasterCategory"("name");

-- CreateIndex
CREATE INDEX "Master_categoryId_idx" ON "Master"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Master_categoryId_code_key" ON "Master"("categoryId", "code");

-- AddForeignKey
ALTER TABLE "Master" ADD CONSTRAINT "Master_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MasterCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
