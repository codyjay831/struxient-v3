-- CreateTable
CREATE TABLE "CompletionProof" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "runtimeTaskId" TEXT NOT NULL,
    "taskExecutionId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionProof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompletionProofAttachment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "completionProofId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompletionProofAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompletionProof_taskExecutionId_key" ON "CompletionProof"("taskExecutionId");

-- CreateIndex
CREATE INDEX "CompletionProof_tenantId_idx" ON "CompletionProof"("tenantId");

-- CreateIndex
CREATE INDEX "CompletionProof_runtimeTaskId_idx" ON "CompletionProof"("runtimeTaskId");

-- CreateIndex
CREATE INDEX "CompletionProofAttachment_tenantId_idx" ON "CompletionProofAttachment"("tenantId");

-- CreateIndex
CREATE INDEX "CompletionProofAttachment_completionProofId_idx" ON "CompletionProofAttachment"("completionProofId");

-- AddForeignKey
ALTER TABLE "CompletionProof" ADD CONSTRAINT "CompletionProof_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionProof" ADD CONSTRAINT "CompletionProof_runtimeTaskId_fkey" FOREIGN KEY ("runtimeTaskId") REFERENCES "RuntimeTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionProof" ADD CONSTRAINT "CompletionProof_taskExecutionId_fkey" FOREIGN KEY ("taskExecutionId") REFERENCES "TaskExecution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionProofAttachment" ADD CONSTRAINT "CompletionProofAttachment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionProofAttachment" ADD CONSTRAINT "CompletionProofAttachment_completionProofId_fkey" FOREIGN KEY ("completionProofId") REFERENCES "CompletionProof"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompletionProofAttachment" ADD CONSTRAINT "CompletionProofAttachment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
