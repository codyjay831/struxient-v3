-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "QuoteVersionStatus" AS ENUM ('DRAFT', 'SENT');

-- CreateEnum
CREATE TYPE "ScopePacketRevisionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "WorkflowVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "PacketTaskLineKind" AS ENUM ('EMBEDDED');

-- CreateEnum
CREATE TYPE "QuoteLineItemExecutionMode" AS ENUM ('SOLD_SCOPE', 'MANIFEST');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('QUOTE_VERSION_SENT');

-- CreateEnum
CREATE TYPE "PreJobTaskStatus" AS ENUM ('OPEN', 'READY', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QuoteLocalPacketOrigin" AS ENUM ('FORK_FROM_LIBRARY', 'AI_DRAFT', 'MANUAL_LOCAL');

-- CreateEnum
CREATE TYPE "QuoteLocalPromotionStatus" AS ENUM ('NONE', 'REQUESTED', 'IN_REVIEW', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuoteLocalPacketLineKind" AS ENUM ('EMBEDDED', 'LIBRARY');

-- CreateEnum
CREATE TYPE "TaskDefinitionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskDefinition" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "status" "TaskDefinitionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "billingAddressJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreJobTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "quoteVersionId" TEXT,
    "taskType" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedToUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "status" "PreJobTaskStatus" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreJobTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopePacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "packetKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "ScopePacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScopePacketRevision" (
    "id" TEXT NOT NULL,
    "scopePacketId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" "ScopePacketRevisionStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScopePacketRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacketTaskLine" (
    "id" TEXT NOT NULL,
    "scopePacketRevisionId" TEXT NOT NULL,
    "lineKey" TEXT NOT NULL,
    "tierCode" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "lineKind" "PacketTaskLineKind" NOT NULL,
    "embeddedPayloadJson" JSONB NOT NULL,

    CONSTRAINT "PacketTaskLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,

    CONSTRAINT "WorkflowTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowVersion" (
    "id" TEXT NOT NULL,
    "workflowTemplateId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "WorkflowVersionStatus" NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "snapshotJson" JSONB NOT NULL,

    CONSTRAINT "WorkflowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "flowGroupId" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteVersion" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "QuoteVersionStatus" NOT NULL,
    "pinnedWorkflowVersionId" TEXT,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "sendClientRequestId" TEXT,
    "planSnapshotSha256" TEXT,
    "packageSnapshotSha256" TEXT,
    "generatedPlanSnapshot" JSONB,
    "executionPackageSnapshot" JSONB,
    "composePreviewStalenessToken" TEXT,

    CONSTRAINT "QuoteVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLocalPacket" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "originType" "QuoteLocalPacketOrigin" NOT NULL,
    "forkedFromScopePacketRevisionId" TEXT,
    "aiProvenanceJson" JSONB,
    "promotionStatus" "QuoteLocalPromotionStatus" NOT NULL DEFAULT 'NONE',
    "promotedScopePacketId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLocalPacket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLocalPacketItem" (
    "id" TEXT NOT NULL,
    "quoteLocalPacketId" TEXT NOT NULL,
    "lineKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "tierCode" TEXT,
    "lineKind" "QuoteLocalPacketLineKind" NOT NULL,
    "embeddedPayloadJson" JSONB,
    "taskDefinitionId" TEXT,
    "targetNodeKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteLocalPacketItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalGroup" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "ProposalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLineItem" (
    "id" TEXT NOT NULL,
    "quoteVersionId" TEXT NOT NULL,
    "proposalGroupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "scopePacketRevisionId" TEXT,
    "quoteLocalPacketId" TEXT,
    "tierCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "executionMode" "QuoteLineItemExecutionMode" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unitPriceCents" INTEGER,
    "lineTotalCents" INTEGER,

    CONSTRAINT "QuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventType" "AuditEventType" NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetQuoteVersionId" TEXT NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- CreateIndex
CREATE INDEX "TaskDefinition_tenantId_idx" ON "TaskDefinition"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskDefinition_tenantId_taskKey_key" ON "TaskDefinition"("tenantId", "taskKey");

-- CreateIndex
CREATE INDEX "Customer_tenantId_idx" ON "Customer"("tenantId");

-- CreateIndex
CREATE INDEX "FlowGroup_tenantId_idx" ON "FlowGroup"("tenantId");

-- CreateIndex
CREATE INDEX "FlowGroup_customerId_idx" ON "FlowGroup"("customerId");

-- CreateIndex
CREATE INDEX "PreJobTask_tenantId_flowGroupId_status_idx" ON "PreJobTask"("tenantId", "flowGroupId", "status");

-- CreateIndex
CREATE INDEX "PreJobTask_tenantId_assignedToUserId_status_idx" ON "PreJobTask"("tenantId", "assignedToUserId", "status");

-- CreateIndex
CREATE INDEX "ScopePacket_tenantId_idx" ON "ScopePacket"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ScopePacket_tenantId_packetKey_key" ON "ScopePacket"("tenantId", "packetKey");

-- CreateIndex
CREATE INDEX "ScopePacketRevision_scopePacketId_idx" ON "ScopePacketRevision"("scopePacketId");

-- CreateIndex
CREATE INDEX "ScopePacketRevision_status_idx" ON "ScopePacketRevision"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScopePacketRevision_scopePacketId_revisionNumber_key" ON "ScopePacketRevision"("scopePacketId", "revisionNumber");

-- CreateIndex
CREATE INDEX "PacketTaskLine_scopePacketRevisionId_idx" ON "PacketTaskLine"("scopePacketRevisionId");

-- CreateIndex
CREATE UNIQUE INDEX "PacketTaskLine_scopePacketRevisionId_lineKey_key" ON "PacketTaskLine"("scopePacketRevisionId", "lineKey");

-- CreateIndex
CREATE INDEX "WorkflowTemplate_tenantId_idx" ON "WorkflowTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowTemplate_tenantId_templateKey_key" ON "WorkflowTemplate"("tenantId", "templateKey");

-- CreateIndex
CREATE INDEX "WorkflowVersion_workflowTemplateId_idx" ON "WorkflowVersion"("workflowTemplateId");

-- CreateIndex
CREATE INDEX "WorkflowVersion_status_idx" ON "WorkflowVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "WorkflowVersion_workflowTemplateId_versionNumber_key" ON "WorkflowVersion"("workflowTemplateId", "versionNumber");

-- CreateIndex
CREATE INDEX "Quote_tenantId_idx" ON "Quote"("tenantId");

-- CreateIndex
CREATE INDEX "Quote_customerId_idx" ON "Quote"("customerId");

-- CreateIndex
CREATE INDEX "Quote_flowGroupId_idx" ON "Quote"("flowGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_tenantId_quoteNumber_key" ON "Quote"("tenantId", "quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_sendClientRequestId_key" ON "QuoteVersion"("sendClientRequestId");

-- CreateIndex
CREATE INDEX "QuoteVersion_quoteId_idx" ON "QuoteVersion"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteVersion_status_idx" ON "QuoteVersion"("status");

-- CreateIndex
CREATE INDEX "QuoteVersion_pinnedWorkflowVersionId_idx" ON "QuoteVersion"("pinnedWorkflowVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteVersion_quoteId_versionNumber_key" ON "QuoteVersion"("quoteId", "versionNumber");

-- CreateIndex
CREATE INDEX "QuoteLocalPacket_quoteVersionId_idx" ON "QuoteLocalPacket"("quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteLocalPacket_tenantId_quoteVersionId_idx" ON "QuoteLocalPacket"("tenantId", "quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteLocalPacketItem_quoteLocalPacketId_sortOrder_idx" ON "QuoteLocalPacketItem"("quoteLocalPacketId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteLocalPacketItem_quoteLocalPacketId_lineKey_key" ON "QuoteLocalPacketItem"("quoteLocalPacketId", "lineKey");

-- CreateIndex
CREATE INDEX "ProposalGroup_quoteVersionId_idx" ON "ProposalGroup"("quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteVersionId_idx" ON "QuoteLineItem"("quoteVersionId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_proposalGroupId_idx" ON "QuoteLineItem"("proposalGroupId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_scopePacketRevisionId_idx" ON "QuoteLineItem"("scopePacketRevisionId");

-- CreateIndex
CREATE INDEX "QuoteLineItem_quoteLocalPacketId_idx" ON "QuoteLineItem"("quoteLocalPacketId");

-- CreateIndex
CREATE INDEX "AuditEvent_tenantId_createdAt_idx" ON "AuditEvent"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_targetQuoteVersionId_idx" ON "AuditEvent"("targetQuoteVersionId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskDefinition" ADD CONSTRAINT "TaskDefinition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowGroup" ADD CONSTRAINT "FlowGroup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlowGroup" ADD CONSTRAINT "FlowGroup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreJobTask" ADD CONSTRAINT "PreJobTask_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreJobTask" ADD CONSTRAINT "PreJobTask_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreJobTask" ADD CONSTRAINT "PreJobTask_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreJobTask" ADD CONSTRAINT "PreJobTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopePacket" ADD CONSTRAINT "ScopePacket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScopePacketRevision" ADD CONSTRAINT "ScopePacketRevision_scopePacketId_fkey" FOREIGN KEY ("scopePacketId") REFERENCES "ScopePacket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacketTaskLine" ADD CONSTRAINT "PacketTaskLine_scopePacketRevisionId_fkey" FOREIGN KEY ("scopePacketRevisionId") REFERENCES "ScopePacketRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowTemplate" ADD CONSTRAINT "WorkflowTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowVersion" ADD CONSTRAINT "WorkflowVersion_workflowTemplateId_fkey" FOREIGN KEY ("workflowTemplateId") REFERENCES "WorkflowTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_flowGroupId_fkey" FOREIGN KEY ("flowGroupId") REFERENCES "FlowGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_pinnedWorkflowVersionId_fkey" FOREIGN KEY ("pinnedWorkflowVersionId") REFERENCES "WorkflowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteVersion" ADD CONSTRAINT "QuoteVersion_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacket" ADD CONSTRAINT "QuoteLocalPacket_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacket" ADD CONSTRAINT "QuoteLocalPacket_forkedFromScopePacketRevisionId_fkey" FOREIGN KEY ("forkedFromScopePacketRevisionId") REFERENCES "ScopePacketRevision"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacket" ADD CONSTRAINT "QuoteLocalPacket_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacket" ADD CONSTRAINT "QuoteLocalPacket_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacketItem" ADD CONSTRAINT "QuoteLocalPacketItem_quoteLocalPacketId_fkey" FOREIGN KEY ("quoteLocalPacketId") REFERENCES "QuoteLocalPacket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLocalPacketItem" ADD CONSTRAINT "QuoteLocalPacketItem_taskDefinitionId_fkey" FOREIGN KEY ("taskDefinitionId") REFERENCES "TaskDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalGroup" ADD CONSTRAINT "ProposalGroup_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteVersionId_fkey" FOREIGN KEY ("quoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_proposalGroupId_fkey" FOREIGN KEY ("proposalGroupId") REFERENCES "ProposalGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_scopePacketRevisionId_fkey" FOREIGN KEY ("scopePacketRevisionId") REFERENCES "ScopePacketRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quoteLocalPacketId_fkey" FOREIGN KEY ("quoteLocalPacketId") REFERENCES "QuoteLocalPacket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_targetQuoteVersionId_fkey" FOREIGN KEY ("targetQuoteVersionId") REFERENCES "QuoteVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DB-enforced invariants (see docs/schema-slice-1/04-slice-1-relations-and-invariants.md; docs/schema-slice-1-codepack/03-prisma-schema-draft-v0.md)
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_manifest_scope_pin_xor" CHECK (
  ("executionMode" <> 'MANIFEST'::"QuoteLineItemExecutionMode")
  OR (
    ("scopePacketRevisionId" IS NOT NULL AND "quoteLocalPacketId" IS NULL)
    OR ("scopePacketRevisionId" IS NULL AND "quoteLocalPacketId" IS NOT NULL)
  )
);

ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_quantity_positive" CHECK ("quantity" > 0);
