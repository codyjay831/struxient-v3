import { PrismaClient } from "@prisma/client";
import { createChangeOrderForJob } from "../../src/server/slice1/mutations/create-change-order";
import { applyChangeOrderForJob } from "../../src/server/slice1/mutations/apply-change-order";
import { getFlowExecutionReadModel } from "../../src/server/slice1/reads/flow-execution";
import { toFlowExecutionApiDto } from "../../src/lib/flow-execution-dto";
import { getPrisma } from "../../src/server/db/prisma";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";

/**
 * Integration test for Runtime Execution Surface (Epic 41/44).
 * Verifies that the work feed:
 * 1. Correctly filters out superseded tasks.
 * 2. Correctly reflects payment gate blocking.
 */
async function testExecutionSurface() {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).substring(7);
  const tenantId = `test-tenant-exec-${suffix}`;
  const userId = `test-user-office-${suffix}`;

  console.log(`Setting up test data with suffix ${suffix}...`);

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: `Exec Test Tenant ${suffix}` } });
  await prisma.user.create({ data: { id: userId, tenantId, email: `office-${suffix}@test.com`, role: "OFFICE_ADMIN" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Test Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Test FG" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: "Q-EXEC-1" } });
  
  const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: "TK", displayName: "Test Template" } });
  const wv = await prisma.workflowVersion.create({ 
    data: { 
      workflowTemplateId: wt.id, 
      versionNumber: 1, 
      status: "PUBLISHED", 
      publishedAt: new Date(),
      snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] }
    } 
  });

  const qv1Id = `qv1-${suffix}`;
  const pkgV1 = {
    schemaVersion: "executionPackageSnapshot.v0",
    pinnedWorkflowVersionId: wv.id,
    slots: [{ packageTaskId: "PT-A", nodeId: "N1", source: "SOLD_SCOPE", planTaskIds: ["PL-A"], displayTitle: "Task A", lineItemId: "L1" }],
    skippedSkeletonSlotCount: 0
  };
  const planV1 = { schemaVersion: "generatedPlanSnapshot.v0", quoteVersionId: qv1Id, rows: [{ planTaskId: "PL-A" }] };

  await prisma.quoteVersion.create({ 
    data: { 
      id: qv1Id,
      quoteId: quote.id, 
      versionNumber: 1, 
      status: "SIGNED", 
      createdById: userId,
      pinnedWorkflowVersionId: wv.id,
      executionPackageSnapshot: pkgV1,
      packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV1)),
      generatedPlanSnapshot: planV1,
      planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV1)),
    } 
  });

  const job = await prisma.job.create({ data: { tenantId, flowGroupId: flowGroup.id } });
  const flow1 = await prisma.flow.create({ data: { tenantId, jobId: job.id, quoteVersionId: qv1Id, workflowVersionId: wv.id } });
  await prisma.activation.create({ 
    data: { tenantId, jobId: job.id, flowId: flow1.id, quoteVersionId: qv1Id, packageSnapshotSha256: "hash", activatedById: userId } 
  });

  await prisma.runtimeTask.create({
    data: { tenantId, flowId: flow1.id, packageTaskId: "PT-A", nodeId: "N1", quoteVersionId: qv1Id, lineItemId: "L1", planTaskIds: ["PL-A"], displayTitle: "Task A" }
  });

  // 1. Initial State: Task A should be visible
  console.log("Checking initial work feed...");
  const model1 = await getFlowExecutionReadModel(prisma, { tenantId, flowId: flow1.id });
  const dto1 = toFlowExecutionApiDto(model1!);
  if (dto1.workItems.length === 0) throw new Error("Task A should be visible");
  console.log("OK: Task A visible.");

  // 2. Create Change Order and Apply
  console.log("Applying Change Order to supersede Task A...");
  const coResult = await createChangeOrderForJob(prisma, { tenantId, jobId: job.id, reason: "Supersede", createdById: userId });
  const qv2Id = coResult.data.draftQuoteVersionId;
  const pkgV2 = {
    schemaVersion: "executionPackageSnapshot.v0",
    pinnedWorkflowVersionId: wv.id,
    slots: [{ packageTaskId: "PT-B", nodeId: "N1", source: "SOLD_SCOPE", planTaskIds: ["PL-B"], displayTitle: "Task B", lineItemId: "L2" }],
    skippedSkeletonSlotCount: 0
  };
  const planV2 = { schemaVersion: "generatedPlanSnapshot.v0", quoteVersionId: qv2Id, rows: [{ planTaskId: "PL-B" }] };

  await prisma.quoteVersion.update({
    where: { id: qv2Id },
    data: {
      status: "SIGNED",
      executionPackageSnapshot: pkgV2,
      packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
      generatedPlanSnapshot: planV2,
      planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
    }
  });

  const applyResult = await applyChangeOrderForJob(prisma, { tenantId, changeOrderId: coResult.data.changeOrderId, appliedByUserId: userId });
  if (!applyResult.ok) throw new Error("Apply failed");

  // 3. Verify Task A is filtered out of Flow 1 view
  console.log("Verifying Task A is filtered out...");
  const model2 = await getFlowExecutionReadModel(prisma, { tenantId, flowId: flow1.id });
  const dto2 = toFlowExecutionApiDto(model2!);
  const taskA = dto2.workItems.find(i => i.kind === "RUNTIME" && i.displayTitle === "Task A");
  if (taskA) throw new Error("Task A should have been filtered out");
  console.log("OK: Task A filtered.");

  // 4. Test Payment Gate Blocking in DTO
  console.log("Testing payment gate blocking in work feed...");
  const flow2Id = (await prisma.flow.findFirst({ where: { quoteVersionId: qv2Id } }))!.id;
  const taskBId = (await prisma.runtimeTask.findFirst({ where: { flowId: flow2Id } }))!.id;

  await prisma.paymentGate.create({
    data: {
      tenantId,
      jobId: job.id,
      quoteVersionId: qv2Id,
      title: "Gate B",
      status: "UNSATISFIED",
      targets: { create: { taskKind: "RUNTIME", taskId: taskBId } }
    }
  });

  const model3 = await getFlowExecutionReadModel(prisma, { tenantId, flowId: flow2Id });
  const dto3 = toFlowExecutionApiDto(model3!);
  const taskB = dto3.workItems.find(i => i.kind === "RUNTIME" && i.displayTitle === "Task B")!;
  
  if (taskB.actionability.start.canStart) throw new Error("Task B should be blocked by gate");
  if (!taskB.actionability.start.reasons.includes("PAYMENT_GATE_UNSATISFIED")) throw new Error("Missing gate block reason");
  
  console.log("OK: Payment gate correctly blocks task in work feed DTO.");

  console.log("\nALL EXECUTION SURFACE TESTS PASSED!");
}

testExecutionSurface().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
