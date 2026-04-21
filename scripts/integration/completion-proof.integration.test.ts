import { PrismaClient } from "@prisma/client";
import { completeRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { getFlowExecutionReadModel } from "../../src/server/slice1/reads/flow-execution";
import { toFlowExecutionApiDto } from "../../src/lib/flow-execution-dto";
import { getPrisma } from "../../src/server/db/prisma";

/**
 * Integration test for Field Completion Proof Backbone (Epic 41/44 expansion).
 * Verifies that:
 * 1. Completion proof can be stored during task completion.
 * 2. Completion proof is correctly retrieved and surfaced in the DTO.
 */
async function testCompletionProof() {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).substring(7);
  const tenantId = `test-tenant-proof-${suffix}`;
  const userId = `test-user-field-${suffix}`;

  console.log(`Setting up test data with suffix ${suffix}...`);

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: `Proof Test Tenant ${suffix}` } });
  await prisma.user.create({ data: { id: userId, tenantId, email: `field-${suffix}@test.com`, role: "FIELD_WORKER" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Test Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Test FG" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-PROOF-${suffix}` } });
  
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
    data: { 
      id: qvId,
      quoteId: quote.id, 
      versionNumber: 1, 
      status: "SIGNED", 
      createdById: userId,
      pinnedWorkflowVersionId: wv.id,
    } 
  });

  const job = await prisma.job.create({ data: { tenantId, flowGroupId: flowGroup.id } });
  const flow = await prisma.flow.create({ data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id } });
  await prisma.activation.create({ 
    data: { tenantId, jobId: job.id, flowId: flow.id, quoteVersionId: qvId, packageSnapshotSha256: "hash", activatedById: userId } 
  });

  const rt = await prisma.runtimeTask.create({
    data: { 
      tenantId, 
      flowId: flow.id, 
      packageTaskId: "PT-A", 
      nodeId: "N1", 
      quoteVersionId: qvId, 
      lineItemId: "L1", 
      planTaskIds: ["PL-A"], 
      displayTitle: "Task with Proof" 
    }
  });

  // 1. Start the task
  console.log("Starting task...");
  await prisma.taskExecution.create({
    data: {
      tenantId,
      flowId: flow.id,
      taskKind: "RUNTIME",
      runtimeTaskId: rt.id,
      eventType: "STARTED",
      actorUserId: userId,
    }
  });

  // 2. Complete the task with proof
  console.log("Completing task with proof...");
  const proofNote = "Work verified and completed by field worker.";
  const attachmentKeys = ["proof/photo1.jpg", "proof/photo2.png"];
  
  const result = await completeRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rt.id,
    actorUserId: userId,
    request: {
      notes: "Internal completion note",
      completionProof: {
        note: proofNote,
        attachmentKeys: attachmentKeys
      }
    }
  });

  if (!result.ok) {
    throw new Error(`Complete failed: ${JSON.stringify(result)}`);
  }

  // 3. Verify persistence
  console.log("Verifying persistence...");
  const proof = await prisma.completionProof.findFirst({
    where: { taskExecutionId: result.data.taskExecutionId },
    include: { attachments: true }
  });

  if (!proof) throw new Error("Completion proof not found in database");
  if (proof.note !== proofNote) throw new Error("Incorrect proof note");
  if (proof.attachments.length !== 2) throw new Error("Incorrect attachment count");
  if (!proof.attachments.some(a => a.storageKey === attachmentKeys[0])) throw new Error("Missing attachment 1");
  
  console.log("OK: Data persisted correctly in database.");

  // 4. Verify Read Model and DTO
  console.log("Verifying read model and DTO...");
  const model = await getFlowExecutionReadModel(prisma, { tenantId, flowId: flow.id });
  console.log("DEBUG model.runtimeTasks[0].execution:", JSON.stringify(model!.runtimeTasks[0].execution, null, 2));
  const dto = toFlowExecutionApiDto(model!);
  const taskDto = dto.workItems.find(i => i.kind === "RUNTIME" && i.displayTitle === "Task with Proof")!;

  if (taskDto.execution.status !== "completed") throw new Error("Status should be completed");
  if (!taskDto.execution.completionProof) throw new Error("Completion proof missing in DTO");
  if (taskDto.execution.completionProof.note !== proofNote) throw new Error("Incorrect proof note in DTO");
  if (taskDto.execution.completionProof.attachments.length !== 2) throw new Error("Incorrect attachment count in DTO");

  console.log("OK: Read model and DTO surface proof correctly.");
  console.log("DEBUG taskDto.execution:", JSON.stringify(taskDto.execution, null, 2));

  console.log("\nALL COMPLETION PROOF TESTS PASSED!");
}

testCompletionProof().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
