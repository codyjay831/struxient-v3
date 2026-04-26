import { getPrisma } from "../../src/server/db/prisma";
import { manageFlowShareForTenant } from "../../src/server/slice1/mutations/flow-share";
import { getFlowEvidenceReportReadModel } from "../../src/server/slice1/reads/flow-evidence-report";

/**
 * Integration test for Customer Share Workflow Backbone.
 * Verifies that:
 * 1. Tokenized access is blocked if status is UNPUBLISHED.
 * 2. Tokenized access is allowed after PUBLISH.
 * 3. Access is blocked again after REVOKE.
 * 4. Access is blocked after REGENERATE for the old token, and allowed for the new one.
 */
async function testShareWorkflow() {
  const prisma = getPrisma();
  const suffix = Math.random().toString(36).substring(7);
  const tenantId = `test-tenant-share-${suffix}`;
  const userId = `test-user-share-${suffix}`;

  console.log(`Setting up test data with suffix ${suffix}...`);

  // Setup
  await prisma.tenant.create({ data: { id: tenantId, name: `Share Test Tenant ${suffix}` } });
  await prisma.user.create({ data: { id: userId, tenantId, email: `share-${suffix}@test.com`, role: "OFFICE_ADMIN" } });
  const customer = await prisma.customer.create({ data: { tenantId, name: "Share Customer" } });
  const flowGroup = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "Share Project" } });
  const quote = await prisma.quote.create({ data: { tenantId, customerId: customer.id, flowGroupId: flowGroup.id, quoteNumber: `Q-SHARE-${suffix}` } });
  const wv = await prisma.workflowVersion.create({ 
    data: { 
      workflowTemplate: { create: { tenantId, templateKey: `TK-SH-${suffix}`, displayName: "Share Template" } },
      versionNumber: 1, 
      status: "PUBLISHED", 
      publishedAt: new Date(),
      snapshotJson: { nodes: [{ id: "install", type: "TASK", tasks: [] }] }
    } 
  });
  const qvId = `qv-sh-${suffix}`;
  await prisma.quoteVersion.create({ 
    data: { id: qvId, quoteId: quote.id, versionNumber: 1, status: "SIGNED", createdById: userId, pinnedWorkflowVersionId: wv.id } 
  });
  const job = await prisma.job.create({ data: { tenantId, flowGroupId: flowGroup.id } });
  
  const flow = await prisma.flow.create({ 
    data: { 
      tenantId, 
      jobId: job.id, 
      quoteVersionId: qvId, 
      workflowVersionId: wv.id,
      publicShareStatus: "UNPUBLISHED" // Start as unpublished
    } 
  });

  const initialToken = flow.publicShareToken;
  if (!initialToken) throw new Error("Initial token should exist by default due to @default(cuid())");

  // 1. Verify UNPUBLISHED blocks access
  console.log("1. Verifying UNPUBLISHED blocks tokenized access...");
  const unpublishedReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: initialToken });
  if (unpublishedReport !== null) throw new Error("Should not be able to retrieve unpublished report via token");

  // 2. Publish and Verify Access
  console.log("2. Publishing and verifying access...");
  await manageFlowShareForTenant(prisma, {
    tenantId,
    flowId: flow.id,
    actorUserId: userId,
    action: "PUBLISH"
  });

  const publishedReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: initialToken });
  if (!publishedReport) throw new Error("Should be able to retrieve published report via token");
  if (publishedReport.flow.id !== flow.id) throw new Error("Flow ID mismatch in published report");

  // 3. Revoke and Verify Denial
  console.log("3. Revoking and verifying access denial...");
  await manageFlowShareForTenant(prisma, {
    tenantId,
    flowId: flow.id,
    actorUserId: userId,
    action: "REVOKE"
  });

  const revokedReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: initialToken });
  if (revokedReport !== null) throw new Error("Should not be able to retrieve revoked report via token");

  // 4. Regenerate and Verify Access Lifecycle
  console.log("4. Regenerating token and verifying access lifecycle...");
  const regenResult = await manageFlowShareForTenant(prisma, {
    tenantId,
    flowId: flow.id,
    actorUserId: userId,
    action: "REGENERATE"
  });
  if (!regenResult.ok) throw new Error("Regeneration failed");
  const newToken = regenResult.data.publicShareToken;
  if (!newToken || newToken === initialToken) throw new Error("New token should be different and present");

  // Status is still UNPUBLISHED (from step 3), so even with new token it should be blocked
  const regenUnpublishedReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: newToken });
  if (regenUnpublishedReport !== null) throw new Error("New token should still be blocked if UNPUBLISHED");

  // Re-publish with new token
  await manageFlowShareForTenant(prisma, {
    tenantId,
    flowId: flow.id,
    actorUserId: userId,
    action: "PUBLISH"
  });
  const regenPublishedReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: newToken });
  if (!regenPublishedReport) throw new Error("Should be able to retrieve published report via NEW token");

  // Verify OLD token still blocked
  const oldTokenReport = await getFlowEvidenceReportReadModel(prisma, { shareToken: initialToken });
  if (oldTokenReport !== null) throw new Error("Old token should remain blocked after regeneration");

  console.log("\nALL SHARE WORKFLOW TESTS PASSED!");
}

testShareWorkflow().catch(e => {
  console.error("TEST FAILED:", e);
  process.exit(1);
});
