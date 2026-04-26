import { PrismaClient } from "@prisma/client";
import { createChangeOrderForJob } from "../../src/server/slice1/mutations/create-change-order";
import { applyChangeOrderForJob } from "../../src/server/slice1/mutations/apply-change-order";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { getJobShellReadModel } from "../../src/server/slice1/reads/job-shell";
import { getPrisma } from "../../src/server/db/prisma";
import { sha256HexUtf8, canonicalStringify } from "../../src/server/slice1/compose-preview/freeze-snapshots";

/**
 * Integration test for Change Order backbone (Epic 37).
 * Verifies controlled post-activation mutation, execution transfer, and gate blocking.
 */
async function testChangeOrders() {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).substring(7);
  const tenantId = `test-tenant-co-${suffix}`;
  const userId = `test-user-office-${suffix}`;

  console.log(`Setting up test data with suffix ${suffix}...`);

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: `CO Test Tenant ${suffix}` } });
  await prisma.user.create({ data: { id: userId, tenantId, email: `office-${suffix}@test.com`, role: "OFFICE_ADMIN" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Test Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Test FG" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: "Q-CO-1" } });
  
  const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: "TK", displayName: "Test Template" } });
  const wv = await prisma.workflowVersion.create({ 
    data: { 
      workflowTemplateId: wt.id, 
      versionNumber: 1, 
      status: "PUBLISHED", 
      publishedAt: new Date(),
      snapshotJson: { nodes: [{ id: "install", type: "TASK" }, { id: "final-inspection", type: "TASK" }] }
    } 
  });

  const qv1Id = `qv1-${suffix}`;
  // V1 with Task A (N1)
  const pkgV1 = {
    schemaVersion: "executionPackageSnapshot.v0",
    pinnedWorkflowVersionId: wv.id,
    slots: [
      { packageTaskId: "PT-A", nodeId: "install", source: "SOLD_SCOPE", planTaskIds: ["PL-A"], displayTitle: "Task A", lineItemId: "L1" }
    ],
    skippedSkeletonSlotCount: 0
  };
  const planV1 = { 
    schemaVersion: "generatedPlanSnapshot.v0", 
    quoteVersionId: qv1Id,
    rows: [{ planTaskId: "PL-A" }] 
  };

  const qv1 = await prisma.quoteVersion.create({ 
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
  
  const flow1 = await prisma.flow.create({ 
    data: { 
      tenantId, 
      jobId: job.id, 
      quoteVersionId: qv1.id, 
      workflowVersionId: wv.id 
    } 
  });
  await prisma.activation.create({ 
    data: { 
      tenantId, 
      jobId: job.id, 
      flowId: flow1.id, 
      quoteVersionId: qv1.id, 
      packageSnapshotSha256: qv1.packageSnapshotSha256!, 
      activatedById: userId 
    } 
  });

  const rtA = await prisma.runtimeTask.create({
    data: {
      tenantId,
      flowId: flow1.id,
      packageTaskId: "PT-A",
      nodeId: "install",
      quoteVersionId: qv1.id,
      lineItemId: "L1",
      planTaskIds: ["PL-A"],
      displayTitle: "Task A",
    }
  });

  // 1. Start Task A
  console.log("Starting Task A...");
  await startRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rtA.id,
    actorUserId: userId,
    request: {},
  });

  // 2. Create Change Order
  console.log("Creating Change Order...");
  const coResult = await createChangeOrderForJob(prisma, {
    tenantId,
    jobId: job.id,
    reason: "Add Task B",
    createdById: userId,
  });

  if (!coResult.ok) throw new Error("Failed to create CO");
  const coId = coResult.data.changeOrderId;
  const qv2Id = coResult.data.draftQuoteVersionId;

  // 3. Setup V2 Snapshot (cloned from V1 but with Task B added)
  console.log("Setting up CO draft (V2) snapshots...");
  const pkgV2 = {
    schemaVersion: "executionPackageSnapshot.v0",
    pinnedWorkflowVersionId: wv.id,
    slots: [
      { packageTaskId: "PT-A", nodeId: "install", source: "SOLD_SCOPE", planTaskIds: ["PL-A"], displayTitle: "Task A", lineItemId: "L1" },
      { packageTaskId: "PT-B", nodeId: "final-inspection", source: "SOLD_SCOPE", planTaskIds: ["PL-B"], displayTitle: "Task B", lineItemId: "L2" }
    ],
    skippedSkeletonSlotCount: 0
  };
  const planV2 = { 
    schemaVersion: "generatedPlanSnapshot.v0", 
    quoteVersionId: qv2Id,
    rows: [{ planTaskId: "PL-A" }, { planTaskId: "PL-B" }] 
  };

  await prisma.quoteVersion.update({
    where: { id: qv2Id },
    data: {
      status: "SIGNED", // Mark as signed to allow apply
      executionPackageSnapshot: pkgV2,
      packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
      generatedPlanSnapshot: planV2,
      planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
    }
  });

  // 4. Apply CO
  console.log("Applying Change Order...");
  const applyResult = await applyChangeOrderForJob(prisma, {
    tenantId,
    changeOrderId: coId,
    appliedByUserId: userId,
  });

  if (!applyResult.ok) throw new Error(`Apply failed: ${JSON.stringify(applyResult)}`);
  console.log(`OK: CO applied. Superseded: ${applyResult.data.supersededTaskCount}, Added: ${applyResult.data.addedTaskCount}, Transferred: ${applyResult.data.transferredExecutionCount}`);
  
  if (applyResult.data.transferredExecutionCount !== 1) throw new Error("Should have transferred 1 execution for Task A");

  // 5. Verify Read Model
  console.log("Verifying read model...");
  const jobShell = await getJobShellReadModel(prisma, { tenantId, jobId: job.id });
  if (!jobShell) throw new Error("Job shell not found");

  // Filter out superseded flows if any, but our read model filters at task level
  const activeTasks = jobShell.flows.flatMap(f => f.runtimeTasks);
  
  if (activeTasks.length !== 2) throw new Error(`Expected 2 active tasks, got ${activeTasks.length}`);
  
  const rtA_prime = activeTasks.find(t => t.packageTaskId === "PT-A");
  const rtB = activeTasks.find(t => t.packageTaskId === "PT-B");

  if (!rtA_prime || !rtB) throw new Error("Missing tasks in read model");
  if (rtA_prime.execution.status !== "in_progress") throw new Error(`Task A prime should be in_progress (transferred), got ${rtA_prime.execution.status}`);
  if (rtB.execution.status !== "not_started") throw new Error("Task B should NOT be started");

  console.log("OK: Read model correctly reflects CO deltas and execution transfer.");

  // 6. Test Payment Gate Blocking
  console.log("Testing payment gate blocking for next CO...");
  const co2Result = await createChangeOrderForJob(prisma, {
    tenantId,
    jobId: job.id,
    reason: "CO with gate",
    createdById: userId,
  });
  if (!co2Result.ok) throw new Error("Failed to create CO2");

  // Create gate for Task A'
  const gate = await prisma.paymentGate.create({
    data: {
      tenantId,
      jobId: job.id,
      quoteVersionId: qv2Id, // link to V2
      title: "CO Gate",
      status: "UNSATISFIED",
      targets: {
        create: {
          taskKind: "RUNTIME",
          taskId: rtA_prime.id,
        }
      }
    }
  });

  // Fake sign V3 for CO2
  const qv3Id = co2Result.data.draftQuoteVersionId;
  const planV3 = { ...planV2, quoteVersionId: qv3Id };

  await prisma.quoteVersion.update({
    where: { id: qv3Id },
    data: {
      status: "SIGNED",
      executionPackageSnapshot: pkgV2, 
      packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
      generatedPlanSnapshot: planV3,
      planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV3)),
    }
  });

  console.log("Applying CO2 while gate is unsatisfied...");
  const apply2Result = await applyChangeOrderForJob(prisma, {
    tenantId,
    changeOrderId: co2Result.data.changeOrderId,
    appliedByUserId: userId,
  });

  if (apply2Result.ok) throw new Error("Should have blocked CO apply due to gate");
  if (apply2Result.kind !== "payment_gate_block") throw new Error(`Expected payment_gate_block, got ${apply2Result.kind}`);
  console.log("OK: Correctly blocked by payment gate.");

  console.log("\nALL CHANGE ORDER TESTS PASSED!");
}

testChangeOrders().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
