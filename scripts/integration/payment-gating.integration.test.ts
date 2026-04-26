import { PrismaClient } from "@prisma/client";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { satisfyPaymentGateForTenant } from "../../src/server/slice1/mutations/satisfy-payment-gate";
import { getPrisma } from "../../src/server/db/prisma";

/**
 * Integration test for Payment Gating backbone (Epic 47).
 * Verifies that unsatisfied gates block task starts and satisfying them unlocks.
 */
async function testPaymentGating() {
  const prisma = getPrisma();
  const tenantId = "test-tenant-gating";
  const userId = "test-user-office";

  console.log("Setting up test data...");

  // Clean up
  await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
  await prisma.paymentGate.deleteMany({ where: { tenantId } });
  await prisma.taskExecution.deleteMany({ where: { tenantId } });
  await prisma.runtimeTask.deleteMany({ where: { tenantId } });
  await prisma.activation.deleteMany({ where: { tenantId } });
  await prisma.flow.deleteMany({ where: { tenantId } });
  await prisma.job.deleteMany({ where: { tenantId } });
  await prisma.quoteVersion.deleteMany({ where: { quote: { tenantId } } });
  await prisma.quote.deleteMany({ where: { tenantId } });
  await prisma.flowGroup.deleteMany({ where: { tenantId } });
  await prisma.customer.deleteMany({ where: { tenantId } });
  await prisma.user.deleteMany({ where: { tenantId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: "Gating Test Tenant" } });
  await prisma.user.create({ data: { id: userId, tenantId, email: "office@test.com", role: "OFFICE_ADMIN" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Test Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Test FG" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: "Q-GATE-1" } });
  const qv = await prisma.quoteVersion.create({ 
    data: { 
      quoteId: quote.id, 
      versionNumber: 1, 
      status: "SIGNED", 
      createdById: userId 
    } 
  });
  const job = await prisma.job.create({ data: { tenantId, flowGroupId: flowGroup.id } });
  
  // Create workflow template and version for flow
  const wt = await prisma.workflowTemplate.create({ data: { tenantId, templateKey: "TK", displayName: "Test Template" } });
  const wv = await prisma.workflowVersion.create({ 
    data: { 
      workflowTemplateId: wt.id, 
      versionNumber: 1, 
      status: "PUBLISHED", 
      publishedAt: new Date(),
      snapshotJson: { nodes: [{ id: "install", type: "TASK" }] }
    } 
  });

  const flow = await prisma.flow.create({ 
    data: { 
      tenantId, 
      jobId: job.id, 
      quoteVersionId: qv.id, 
      workflowVersionId: wv.id 
    } 
  });
  await prisma.activation.create({ 
    data: { 
      tenantId, 
      jobId: job.id, 
      flowId: flow.id, 
      quoteVersionId: qv.id, 
      packageSnapshotSha256: "fake", 
      activatedById: userId 
    } 
  });

  const rt = await prisma.runtimeTask.create({
    data: {
      tenantId,
      flowId: flow.id,
      packageTaskId: "PT1",
      nodeId: "install",
      quoteVersionId: qv.id,
      lineItemId: "L1",
      planTaskIds: [],
      displayTitle: "Gated Task",
    }
  });

  console.log("Test data setup complete.");

  // 1. Verify task can start WITHOUT gate
  console.log("Testing task start WITHOUT gate...");
  const startResult1 = await startRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rt.id,
    actorUserId: userId,
    request: {},
  });
  if (!startResult1.ok) throw new Error("Should have started task without gate");
  console.log("OK: Started without gate.");

  // Cleanup execution
  await prisma.taskExecution.deleteMany({ where: { runtimeTaskId: rt.id } });

  // 2. Create UNSATISFIED gate
  console.log("Creating unsatisfied gate...");
  const gate = await prisma.paymentGate.create({
    data: {
      tenantId,
      jobId: job.id,
      quoteVersionId: qv.id,
      title: "Deposit Required",
      status: "UNSATISFIED",
      targets: {
        create: {
          taskKind: "RUNTIME",
          taskId: rt.id,
        }
      }
    }
  });

  // 3. Verify task start BLOCKED by gate
  console.log("Testing task start WITH unsatisfied gate...");
  const startResult2 = await startRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rt.id,
    actorUserId: userId,
    request: {},
  });
  if (startResult2.ok) throw new Error("Should have BLOCKED task start");
  if (startResult2.kind !== "payment_gate_unsatisfied") throw new Error(`Expected kind payment_gate_unsatisfied, got ${startResult2.kind}`);
  console.log("OK: Correctly blocked by gate.");

  // 4. Satisfy gate
  console.log("Satisfying gate...");
  const satisfyResult = await satisfyPaymentGateForTenant(prisma, {
    tenantId,
    paymentGateId: gate.id,
    actorUserId: userId,
  });
  if (!satisfyResult.ok) throw new Error("Should have satisfied gate");
  console.log("OK: Gate satisfied.");

  // 5. Verify task start UNBLOCKED
  console.log("Testing task start after satisfying gate...");
  const startResult3 = await startRuntimeTaskForTenant(prisma, {
    tenantId,
    runtimeTaskId: rt.id,
    actorUserId: userId,
    request: {},
  });
  if (!startResult3.ok) throw new Error("Should have UNBLOCKED task start");
  console.log("OK: Started after satisfaction.");

  console.log("\nALL PAYMENT GATING TESTS PASSED!");
}

testPaymentGating().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
