-- CreateTable
CREATE TABLE "MasterExport" (
    "id" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "categoryId" INTEGER,
    "keyword" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "filePath" TEXT,
    "fileName" TEXT,
    "rowCount" INTEGER,
    "errorCode" TEXT,
    "requestedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterExport_createdAt_idx" ON "MasterExport"("createdAt");

-- CreateIndex
CREATE INDEX "MasterExport_requestedBy_idx" ON "MasterExport"("requestedBy");
