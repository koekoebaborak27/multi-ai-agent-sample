-- CreateTable
CREATE TABLE "MasterExcelExport" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "filePath" TEXT,
    "fileName" TEXT,
    "categoryRowCount" INTEGER,
    "masterRowCount" INTEGER,
    "errorCode" TEXT,
    "requestedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MasterExcelExport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterExcelExport_createdAt_idx" ON "MasterExcelExport"("createdAt");
