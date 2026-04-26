import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { parseExecutionPackageSnapshotV0ForActivation } from "../../src/server/slice1/compose-preview/execution-package-for-activation";
import { activateQuoteVersionForTenant } from "../../src/server/slice1/mutations/activate-quote-version";
import {
  createQuoteLineItemForTenant,
  updateQuoteLineItemForTenant,
} from "../../src/server/slice1/mutations/quote-line-item-mutations";
import { satisfyPaymentGateForTenant } from "../../src/server/slice1/mutations/satisfy-payment-gate";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import { signQuoteVersionForTenant } from "../../src/server/slice1/mutations/sign-quote-version";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";

/**
 * Epic 47 end-to-end proof: commercial line flag → send freezes `paymentGateIntent` → activation
 * materializes gate/targets → start blocked until satisfy → satisfy unlocks → idempotent lifecycle
 * does not duplicate gates. Uses `updateQuoteLineItemForTenant` (same path as scope API), not
 * hand-authored `executionPackageSnapshot` JSON. Line rows use `createQuoteLineItemForTenant` +
 * `updateQuoteLineItemForTenant` (same mutations as the REST line-item routes).
 */
describe("Epic 47 payment gate e2e (author line → send freeze → activate → satisfy)", () => {
  it("freezes intent from paymentBeforeWork, materializes gate, blocks start, then unblocks", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pg47e2e-${suffix}`;
    const userId = `user-pg47e2e-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "E2E PG47", autoActivateOnSign: false } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pg47e2e-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QE2E-${suffix}` },
    });
    const qv = await prisma.quoteVersion.create({
      data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
    });
    const group = await prisma.proposalGroup.create({
      data: { quoteVersionId: qv.id, name: "G", sortOrder: 0 },
    });

    let tmplId: string | null = null;

    try {
      const tmpl = await createWorkflowTemplateForTenant(prisma, {
        tenantId,
        templateKey: `pg47e2e-tk-${suffix}`,
        displayName: "E2E template",
      });
      tmplId = tmpl.id;

      const draft = await createWorkflowVersionDraftForTenant(prisma, {
        tenantId,
        workflowTemplateId: tmpl.id,
      });
      if (draft === "not_found") throw new Error("unexpected not_found");

      await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        snapshotJson: { nodes: [{ id: "install", type: "TASK" }] },
      });

      const published = await publishWorkflowVersionForTenant(prisma, {
        tenantId,
        workflowVersionId: draft.id,
        userId,
      });
      if (published === "not_found") throw new Error("unexpected not_found");
      const workflowVersionId = draft.id;

      const pin = await setPinnedWorkflowVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        pinnedWorkflowVersionId: workflowVersionId,
      });
      if (pin === "not_found") throw new Error("unexpected not_found");

      const localPacket = await prisma.quoteLocalPacket.create({
        data: {
          tenantId,
          quoteVersionId: qv.id,
          displayName: "Local packet",
          originType: "MANUAL_LOCAL",
          createdById: userId,
        },
      });

      await prisma.quoteLocalPacketItem.create({
        data: {
          quoteLocalPacketId: localPacket.id,
          lineKey: "line-gate",
          sortOrder: 0,
          lineKind: "EMBEDDED",
          targetNodeKey: "gate-node",
          embeddedPayloadJson: { title: "Gated field task", taskKind: "LABOR" },
        },
      });

      const createdLine = await createQuoteLineItemForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        proposalGroupId: group.id,
        sortOrder: 0,
        quantity: 1,
        executionMode: "MANIFEST",
        title: "Manifest work",
        quoteLocalPacketId: localPacket.id,
      });
      if (createdLine === "not_found") throw new Error("unexpected not_found");

      const authored = await updateQuoteLineItemForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        lineItemId: createdLine.id,
        patch: {
          paymentBeforeWork: true,
          paymentGateTitleOverride: "Deposit before mobilization",
        },
      });
      if (authored === "not_found") throw new Error("unexpected not_found");
      expect(authored.paymentBeforeWork).toBe(true);
      expect(authored.paymentGateTitleOverride).toBe("Deposit before mobilization");

      const qvWithTok = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: { composePreviewStalenessToken: true },
      });

      const sendRes = await sendQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        sentByUserId: userId,
        request: { clientStalenessToken: qvWithTok.composePreviewStalenessToken ?? null },
      });
      expect(sendRes.ok).toBe(true);
      if (!sendRes.ok) throw new Error(`send failed: ${JSON.stringify(sendRes)}`);

      const sentRow = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: qv.id },
        select: { executionPackageSnapshot: true, status: true },
      });
      expect(sentRow.status).toBe("SENT");

      const parsedPkg = parseExecutionPackageSnapshotV0ForActivation(sentRow.executionPackageSnapshot);
      expect(parsedPkg.ok).toBe(true);
      if (!parsedPkg.ok) throw new Error(parsedPkg.message);
      expect(parsedPkg.paymentGateIntent).not.toBeNull();
      expect(parsedPkg.paymentGateIntent!.schemaVersion).toBe("paymentGateIntent.v0");
      expect(parsedPkg.paymentGateIntent!.title).toBe("Deposit before mobilization");
      expect(parsedPkg.paymentGateIntent!.targetPackageTaskIds.length).toBeGreaterThan(0);

      const rtBefore = await prisma.runtimeTask.findFirst({ where: { quoteVersionId: qv.id } });
      expect(rtBefore).toBeNull();

      const signRes = await signQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        recordedByUserId: userId,
      });
      expect(signRes.ok).toBe(true);
      if (!signRes.ok) throw new Error("sign failed");
      expect(signRes.data.activation).toBeUndefined();

      const act1 = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        activatedByUserId: userId,
      });
      expect(act1.ok).toBe(true);
      if (!act1.ok) throw new Error("activate failed");

      const gate = await prisma.paymentGate.findFirst({
        where: { quoteVersionId: qv.id },
        include: { targets: true },
      });
      expect(gate).not.toBeNull();
      expect(gate!.status).toBe("UNSATISFIED");
      expect(gate!.title).toBe("Deposit before mobilization");
      expect(gate!.targets).toHaveLength(1);
      expect(gate!.targets[0]!.taskKind).toBe("RUNTIME");

      const rt = await prisma.runtimeTask.findFirst({
        where: { quoteVersionId: qv.id, packageTaskId: parsedPkg.paymentGateIntent!.targetPackageTaskIds[0]! },
        select: { id: true, packageTaskId: true },
      });
      expect(rt).not.toBeNull();
      expect(gate!.targets[0]!.taskId).toBe(rt!.id);

      const blocked = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rt!.id,
        actorUserId: userId,
        request: {},
      });
      expect(blocked.ok).toBe(false);
      if (blocked.ok) throw new Error("expected block");
      expect(blocked.kind).toBe("payment_gate_unsatisfied");

      const sat = await satisfyPaymentGateForTenant(prisma, {
        tenantId,
        paymentGateId: gate!.id,
        actorUserId: userId,
      });
      expect(sat.ok).toBe(true);
      if (!sat.ok) throw new Error("satisfy failed");

      const unblocked = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rt!.id,
        actorUserId: userId,
        request: {},
      });
      expect(unblocked.ok).toBe(true);
      if (!unblocked.ok) throw new Error("expected start after satisfy");

      const replayStart = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rt!.id,
        actorUserId: userId,
        request: {},
      });
      expect(replayStart.ok).toBe(true);
      if (!replayStart.ok) throw new Error("expected idempotent start");
      expect(replayStart.data.idempotentReplay).toBe(true);

      const act2 = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qv.id,
        activatedByUserId: userId,
      });
      expect(act2.ok).toBe(true);
      if (!act2.ok) throw new Error("second activate failed");

      const gates = await prisma.paymentGate.findMany({ where: { quoteVersionId: qv.id } });
      expect(gates).toHaveLength(1);
    } finally {
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
      await prisma.paymentGate.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { tenantId } });
      await prisma.flow.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.auditEvent.deleteMany({ where: { tenantId } });
      await prisma.quoteSignature.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      if (tmplId) {
        await prisma.workflowVersion.deleteMany({ where: { workflowTemplateId: tmplId } });
        await prisma.workflowTemplate.deleteMany({ where: { id: tmplId } });
      }
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
