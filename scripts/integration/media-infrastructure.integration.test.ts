import { PrismaClient } from "@prisma/client";
import { completeRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { getFlowExecutionReadModel } from "../../src/server/slice1/reads/flow-execution";
import { toFlowExecutionApiDto } from "../../src/lib/flow-execution-dto";
import { getPrisma } from "../../src/server/db/prisma";
import { getStorageProvider } from "../../src/server/media/get-storage-provider";
import fs from "fs/promises";
import path from "path";

/**
 * Integration test for Field Media Infrastructure (Epic 41/44 expansion).
 * Verifies that:
 * 1. Storage provider factory returns the correct provider.
 * 2. Storage provider can upload and download.
 * 3. Completion mutation handles real attachment metadata.
 * 4. Read model surfaces download-ready info.
 */
async function testMediaInfrastructure() {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).substring(7);
  const tenantId = `test-tenant-media-${suffix}`;
  const userId = `test-user-field-${suffix}`;

  console.log(`Setting up test data with suffix ${suffix}...`);

  // Verify factory
  const initialProvider = getStorageProvider();
  console.log(`Using storage provider: ${initialProvider.constructor.name}`);
  if (process.env.STRUXIENT_STORAGE_PROVIDER === "S3") {
    if (initialProvider.constructor.name !== "S3StorageProvider") {
      throw new Error("Factory should have returned S3StorageProvider");
    }
  } else {
    if (initialProvider.constructor.name !== "DiskStorageProvider") {
      throw new Error("Factory should have returned DiskStorageProvider");
    }
  }

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: `Media Test Tenant ${suffix}` } });
  await prisma.user.create({ data: { id: userId, tenantId, email: `field-${suffix}@test.com`, role: "FIELD_WORKER" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Test Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Test FG" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-MEDIA-${suffix}` } });
  
  const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: `TK-${suffix}`, displayName: "Test Template" } });
  const wv = await prisma.workflowVersion.create({ 
    data: { 
      workflowTemplateId: wt.id, 
      versionNumber: 1, 
      status: "PUBLISHED", 
      publishedAt: new Date(),
      snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] }
    } 
  });

  const qvId = `qv-${suffix}`;
  await prisma.quoteVersion.create({ 
    data: { id: qvId, quoteId: quote.id, versionNumber: 1, status: "SIGNED", createdById: userId, pinnedWorkflowVersionId: wv.id } 
  });

  const job = await prisma.job.create({ data: { tenantId, flowGroupId: flowGroup.id } });
  const flow = await prisma.flow.create({ data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id } });
  await prisma.activation.create({ 
    data: { tenantId, jobId: job.id, flowId: flow.id, quoteVersionId: qvId, packageSnapshotSha256: "hash", activatedById: userId } 
  });

  const rt = await prisma.runtimeTask.create({
    data: { tenantId, flowId: flow.id, packageTaskId: "PT-A", nodeId: "N1", quoteVersionId: qvId, lineItemId: "L1", planTaskIds: ["PL-A"], displayTitle: "Task with Media" }
  });

  // 1. Test Storage Provider
  console.log("Testing storage provider...");
  const storage = getStorageProvider();
  const testBuffer = Buffer.from("fake-image-content");
  const testFileName = "test-photo.jpg";
  const testContentType = "image/jpeg";
  
  const storageKey = await storage.upload(testBuffer, testContentType, testFileName);
  console.log(`Uploaded test file, key: ${storageKey}`);

  const download = await storage.download(storageKey);
  if (!download) throw new Error("Download failed");
  if (download.buffer.toString() !== "fake-image-content") throw new Error("Content mismatch");
  if (download.contentType !== testContentType) throw new Error("Content type mismatch");
  if (download.fileName !== testFileName) throw new Error("File name mismatch");
  console.log("OK: Storage provider works.");

  // 2. Complete Task with real media metadata
  console.log("Starting task...");
  await prisma.taskExecution.create({
    data: { tenantId, flowId: flow.id, taskKind: "RUNTIME", runtimeTaskId: rt.id, eventType: "STARTED", actorUserId: userId }
  });

  console.log("Completing task with real media...");
  const proofNote = "Verified with real photo.";
  const result = await completeRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rt.id,
    actorUserId: userId,
    request: {
      completionProof: {
        note: proofNote,
        attachments: [
          {
            key: storageKey,
            fileName: testFileName,
            fileSize: testBuffer.length,
            contentType: testContentType
          }
        ]
      }
    }
  });

  if (!result.ok) throw new Error(`Complete failed: ${JSON.stringify(result)}`);
  console.log("OK: Task completed with real media metadata.");

  // 3. Verify Read Model and DTO
  console.log("Verifying read model surfaces media correctly...");
  const model = await getFlowExecutionReadModel(prisma, { tenantId, flowId: flow.id });
  const dto = toFlowExecutionApiDto(model!);
  const taskDto = dto.workItems.find(i => i.kind === "RUNTIME" && i.displayTitle === "Task with Media")!;

  if (!taskDto.execution.completionProof) throw new Error("Missing proof in DTO");
  const attachment = taskDto.execution.completionProof.attachments[0];
  if (!attachment) throw new Error("Missing attachment in DTO");
  if (attachment.storageKey !== storageKey) throw new Error("Key mismatch in DTO");
  if (attachment.fileName !== testFileName) throw new Error("Name mismatch in DTO");

  console.log("OK: Read model surfaces media for UI download.");
  console.log("\nALL MEDIA INFRASTRUCTURE TESTS PASSED!");
}

testMediaInfrastructure().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
