import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { parseExecutionPackageSnapshotV0ForActivation } from "../../src/server/slice1/compose-preview/execution-package-for-activation";
import { activateQuoteVersionForTenant } from "../../src/server/slice1/mutations/activate-quote-version";
import { createQuoteLineItemForTenant } from "../../src/server/slice1/mutations/quote-line-item-mutations";
import { sendQuoteVersionForTenant } from "../../src/server/slice1/mutations/send-quote-version";
import { signQuoteVersionForTenant } from "../../src/server/slice1/mutations/sign-quote-version";
import {
  createWorkflowTemplateForTenant,
  createWorkflowVersionDraftForTenant,
  publishWorkflowVersionForTenant,
  replaceWorkflowVersionDraftSnapshotForTenant,
  setPinnedWorkflowVersionForTenant,
} from "../../src/server/slice1";

/**
 * Packets Epic closeout — frozen-truth guardrails.
 *
 * Two integration tests pinning the canon promise:
 *
 *   G1. Every manifest slot in `executionPackageSnapshot.v0` becomes a
 *       `RuntimeTask` row whose persisted fields match the *frozen* slot
 *       field-for-field (parsed via `parseExecutionPackageSnapshotV0ForActivation`).
 *
 *   G2. Mutating live source rows (`PacketTaskLine.embeddedPayloadJson`,
 *       `TaskDefinition.instructions`, `QuoteLocalPacketItem.embeddedPayloadJson`)
 *       *after* send/sign cannot change activation output. Activation reads
 *       only the frozen JSON; the runtime task values continue to match the
 *       pre-mutation frozen snapshot.
 *
 * Both tests share `seedSentSignedQuote()` which authors a single quote with
 * one library-packet manifest line AND one quote-local manifest line so the
 * assertions cover both compose paths in a single quote version.
 */

type SeedResult = {
  tenantId: string;
  userId: string;
  quoteId: string;
  quoteVersionId: string;
  workflowTemplateId: string;
  workflowVersionId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  taskDefinitionId: string;
  quoteLocalPacketId: string;
  quoteLocalPacketItemId: string;
  libraryLineItemId: string;
  localLineItemId: string;
  customerId: string;
  flowGroupId: string;
};

async function seedSentSignedQuote(suffix: string): Promise<SeedResult> {
  const prisma = getPrisma();
  const tenantId = `pkt-immut-${suffix}`;
  const userId = `user-${suffix}`;

  await prisma.tenant.create({
    data: { id: tenantId, name: "Immutability T", autoActivateOnSign: false },
  });
  await prisma.user.create({
    data: { id: userId, tenantId, email: `${suffix}@t.com`, role: "OFFICE_ADMIN" },
  });
  const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
  const fg = await prisma.flowGroup.create({
    data: { tenantId, customerId: customer.id, name: "FG" },
  });
  const quote = await prisma.quote.create({
    data: {
      tenantId,
      customerId: customer.id,
      flowGroupId: fg.id,
      quoteNumber: `Q-IMMUT-${suffix}`,
    },
  });
  const qv = await prisma.quoteVersion.create({
    data: { quoteId: quote.id, versionNumber: 1, status: "DRAFT", createdById: userId },
  });
  const group = await prisma.proposalGroup.create({
    data: { quoteVersionId: qv.id, name: "G", sortOrder: 0 },
  });

  const tmpl = await createWorkflowTemplateForTenant(prisma, {
    tenantId,
    templateKey: `wt-${suffix}`,
    displayName: "WT",
  });
  const draft = await createWorkflowVersionDraftForTenant(prisma, {
    tenantId,
    workflowTemplateId: tmpl.id,
  });
  if (draft === "not_found") throw new Error("draft not_found");

  await replaceWorkflowVersionDraftSnapshotForTenant(prisma, {
    tenantId,
    workflowVersionId: draft.id,
    snapshotJson: {
      nodes: [
        { id: "N1", type: "TASK" },
        { id: "N2", type: "TASK" },
      ],
    },
  });
  const published = await publishWorkflowVersionForTenant(prisma, {
    tenantId,
    workflowVersionId: draft.id,
    userId,
  });
  if (published === "not_found") throw new Error("publish not_found");

  const pin = await setPinnedWorkflowVersionForTenant(prisma, {
    tenantId,
    quoteVersionId: qv.id,
    pinnedWorkflowVersionId: draft.id,
  });
  if (pin === "not_found") throw new Error("pin not_found");

  const taskDef = await prisma.taskDefinition.create({
    data: {
      tenantId,
      taskKey: `td-${suffix}`,
      displayName: "Library task def",
      status: "PUBLISHED",
      instructions: "Original library instructions (from TaskDefinition).",
      completionRequirementsJson: [
        { kind: "checklist", label: "Original library checklist", required: true },
      ],
      conditionalRulesJson: [],
    },
  });

  const sp = await prisma.scopePacket.create({
    data: { tenantId, packetKey: `sp-${suffix}`, displayName: "Library packet" },
  });
  const spr = await prisma.scopePacketRevision.create({
    data: {
      scopePacketId: sp.id,
      revisionNumber: 1,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });
  const ptl = await prisma.packetTaskLine.create({
    data: {
      scopePacketRevisionId: spr.id,
      lineKey: `pl-${suffix}`,
      sortOrder: 0,
      lineKind: "LIBRARY",
      targetNodeKey: "N1",
      embeddedPayloadJson: { title: "Original library task title", taskKind: "LABOR" },
      taskDefinitionId: taskDef.id,
    },
  });

  const localPacket = await prisma.quoteLocalPacket.create({
    data: {
      tenantId,
      quoteVersionId: qv.id,
      displayName: "Local packet",
      originType: "MANUAL_LOCAL",
      createdById: userId,
    },
  });
  const localItem = await prisma.quoteLocalPacketItem.create({
    data: {
      quoteLocalPacketId: localPacket.id,
      lineKey: `ll-${suffix}`,
      sortOrder: 0,
      lineKind: "EMBEDDED",
      targetNodeKey: "N2",
      embeddedPayloadJson: {
        title: "Original local task title",
        taskKind: "LABOR",
        instructions: "Original local instructions (from embedded payload).",
        completionRequirementsJson: [
          { kind: "checklist", label: "Original local checklist", required: true },
        ],
      },
    },
  });

  const libraryLine = await createQuoteLineItemForTenant(prisma, {
    tenantId,
    quoteVersionId: qv.id,
    proposalGroupId: group.id,
    sortOrder: 0,
    quantity: 1,
    executionMode: "MANIFEST",
    title: "Library-backed manifest work",
    scopePacketRevisionId: spr.id,
  });
  if (libraryLine === "not_found") throw new Error("library line not_found");

  const localLine = await createQuoteLineItemForTenant(prisma, {
    tenantId,
    quoteVersionId: qv.id,
    proposalGroupId: group.id,
    sortOrder: 1,
    quantity: 1,
    executionMode: "MANIFEST",
    title: "Local-backed manifest work",
    quoteLocalPacketId: localPacket.id,
  });
  if (localLine === "not_found") throw new Error("local line not_found");

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
  if (!sendRes.ok) throw new Error(`send failed: ${JSON.stringify(sendRes)}`);

  const signRes = await signQuoteVersionForTenant(prisma, {
    tenantId,
    quoteVersionId: qv.id,
    recordedByUserId: userId,
  });
  if (!signRes.ok) throw new Error("sign failed");

  return {
    tenantId,
    userId,
    quoteId: quote.id,
    quoteVersionId: qv.id,
    workflowTemplateId: tmpl.id,
    workflowVersionId: draft.id,
    scopePacketId: sp.id,
    scopePacketRevisionId: spr.id,
    packetTaskLineId: ptl.id,
    taskDefinitionId: taskDef.id,
    quoteLocalPacketId: localPacket.id,
    quoteLocalPacketItemId: localItem.id,
    libraryLineItemId: libraryLine.id,
    localLineItemId: localLine.id,
    customerId: customer.id,
    flowGroupId: fg.id,
  };
}

async function cleanupTenant(seed: SeedResult): Promise<void> {
  const prisma = getPrisma();
  const tenantId = seed.tenantId;
  // 1. Rows that FK-restrict QuoteVersion / Job / Tenant directly. AuditEvent
  //    must be wiped before quoteVersion to avoid `AuditEvent_targetQuoteVersionId_fkey`.
  await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
  await prisma.paymentGate.deleteMany({ where: { tenantId } });
  await prisma.taskExecution.deleteMany({ where: { tenantId } });
  await prisma.runtimeTask.deleteMany({ where: { tenantId } });
  await prisma.activation.deleteMany({ where: { tenantId } });
  await prisma.flow.deleteMany({ where: { tenantId } });
  await prisma.job.deleteMany({ where: { tenantId } });
  await prisma.auditEvent.deleteMany({ where: { tenantId } });
  await prisma.quoteSignature.deleteMany({ where: { tenantId } });
  // 2. QuoteVersion delete cascades to QuoteLineItem, ProposalGroup,
  //    QuoteLocalPacket, and QuoteLocalPacketItem (per schema onDelete: Cascade).
  await prisma.quoteVersion.deleteMany({ where: { quoteId: seed.quoteId } });
  await prisma.quote.deleteMany({ where: { id: seed.quoteId } });
  // 3. Library packet rows are now safe — no QuoteLineItem references remain.
  await prisma.packetTaskLine.deleteMany({
    where: { scopePacketRevision: { scopePacket: { tenantId } } },
  });
  await prisma.scopePacketRevision.deleteMany({
    where: { scopePacket: { tenantId } },
  });
  await prisma.scopePacket.deleteMany({ where: { tenantId } });
  await prisma.taskDefinition.deleteMany({ where: { tenantId } });
  await prisma.workflowVersion.deleteMany({
    where: { workflowTemplateId: seed.workflowTemplateId },
  });
  await prisma.workflowTemplate.deleteMany({ where: { id: seed.workflowTemplateId } });
  await prisma.flowGroup.deleteMany({ where: { id: seed.flowGroupId } });
  await prisma.customer.deleteMany({ where: { id: seed.customerId } });
  await prisma.user.deleteMany({ where: { id: seed.userId } });
  await prisma.tenant.deleteMany({ where: { id: tenantId } });
}

describe("Packets Epic — frozen-truth guardrails", () => {
  it("G1: every frozen manifest slot becomes a RuntimeTask row whose fields match the frozen slot field-for-field", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const seed = await seedSentSignedQuote(suffix);
    try {
      const sentRow = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: seed.quoteVersionId },
        select: { executionPackageSnapshot: true, status: true },
      });
      expect(sentRow.status).toBe("SIGNED");

      const parsed = parseExecutionPackageSnapshotV0ForActivation(
        sentRow.executionPackageSnapshot,
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) throw new Error(parsed.message);
      expect(parsed.slots.length).toBe(2);

      const act = await activateQuoteVersionForTenant(prisma, {
        tenantId: seed.tenantId,
        quoteVersionId: seed.quoteVersionId,
        activatedByUserId: seed.userId,
      });
      expect(act.ok).toBe(true);
      if (!act.ok) throw new Error("activation failed");
      expect(act.data.runtimeTaskCount).toBe(parsed.slots.length);

      const runtimeTasks = await prisma.runtimeTask.findMany({
        where: { quoteVersionId: seed.quoteVersionId },
        select: {
          id: true,
          packageTaskId: true,
          nodeId: true,
          lineItemId: true,
          planTaskIds: true,
          displayTitle: true,
          completionRequirementsJson: true,
          conditionalRulesJson: true,
          instructions: true,
        },
      });
      expect(runtimeTasks).toHaveLength(parsed.slots.length);

      const rtByPackageTaskId = new Map(runtimeTasks.map((r) => [r.packageTaskId, r]));

      for (const slot of parsed.slots) {
        const rt = rtByPackageTaskId.get(slot.packageTaskId);
        expect(rt, `RuntimeTask for slot ${slot.packageTaskId} must exist`).toBeDefined();
        if (!rt) continue;

        // Identity
        expect(rt.packageTaskId).toBe(slot.packageTaskId);
        expect(rt.nodeId).toBe(slot.nodeId);
        expect(rt.lineItemId).toBe(slot.lineItemId);

        // Plan task ids: deep equal (order matters for canon stability).
        expect(rt.planTaskIds).toEqual(slot.planTaskIds);

        // Display title (the only authored title surfaced to runtime).
        expect(rt.displayTitle).toBe(slot.displayTitle);

        // Instructions (string | null in both).
        const expectedInstructions = slot.instructions ?? null;
        expect(rt.instructions ?? null).toEqual(expectedInstructions);

        // JSON blobs: deep equal as JS values (Prisma returns parsed JSON).
        expect(rt.completionRequirementsJson ?? null).toEqual(
          slot.completionRequirementsJson ?? null,
        );
        expect(rt.conditionalRulesJson ?? null).toEqual(slot.conditionalRulesJson ?? null);
      }

      // Final invariant: every parsed slot was matched, and there are no extra rows.
      const matchedPackageTaskIds = new Set(
        runtimeTasks.map((r) => r.packageTaskId),
      );
      for (const slot of parsed.slots) {
        expect(matchedPackageTaskIds.has(slot.packageTaskId)).toBe(true);
      }
    } finally {
      await cleanupTenant(seed);
    }
  });

  it("G2: mutating PacketTaskLine, TaskDefinition, and QuoteLocalPacketItem after send/sign cannot change activation output", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const seed = await seedSentSignedQuote(suffix);
    try {
      // Capture frozen truth BEFORE any post-send mutation.
      const sentRow = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: seed.quoteVersionId },
        select: { executionPackageSnapshot: true },
      });
      const frozenBefore = parseExecutionPackageSnapshotV0ForActivation(
        sentRow.executionPackageSnapshot,
      );
      expect(frozenBefore.ok).toBe(true);
      if (!frozenBefore.ok) throw new Error(frozenBefore.message);
      expect(frozenBefore.slots.length).toBe(2);

      // Mutate every live source row that compose-engine read at send time.
      // Direct Prisma writes are intentional: this guardrail proves the
      // *activation* path does not re-read these rows. Public mutations
      // would refuse most of these edits on PUBLISHED revisions; that
      // restriction is itself part of canon and not what's being tested.
      await prisma.packetTaskLine.update({
        where: { id: seed.packetTaskLineId },
        data: {
          embeddedPayloadJson: {
            title: "MUTATED library task title (post-send)",
            taskKind: "LABOR",
          },
        },
      });
      await prisma.taskDefinition.update({
        where: { id: seed.taskDefinitionId },
        data: {
          instructions: "MUTATED library instructions (post-send).",
          completionRequirementsJson: [
            { kind: "checklist", label: "MUTATED library checklist", required: true },
          ],
        },
      });
      await prisma.quoteLocalPacketItem.update({
        where: { id: seed.quoteLocalPacketItemId },
        data: {
          embeddedPayloadJson: {
            title: "MUTATED local task title (post-send)",
            taskKind: "LABOR",
            instructions: "MUTATED local instructions (post-send).",
            completionRequirementsJson: [
              { kind: "checklist", label: "MUTATED local checklist", required: true },
            ],
          },
        },
      });

      // Re-read frozen JSON to assert it is still byte-equivalent to what we
      // captured. (Send is a one-shot freeze; nothing should mutate it.)
      const sentRowAfter = await prisma.quoteVersion.findUniqueOrThrow({
        where: { id: seed.quoteVersionId },
        select: { executionPackageSnapshot: true },
      });
      expect(sentRowAfter.executionPackageSnapshot).toEqual(
        sentRow.executionPackageSnapshot,
      );

      // Activate from frozen-only.
      const act = await activateQuoteVersionForTenant(prisma, {
        tenantId: seed.tenantId,
        quoteVersionId: seed.quoteVersionId,
        activatedByUserId: seed.userId,
      });
      expect(act.ok).toBe(true);
      if (!act.ok) throw new Error("activation failed");

      const runtimeTasks = await prisma.runtimeTask.findMany({
        where: { quoteVersionId: seed.quoteVersionId },
        select: {
          packageTaskId: true,
          displayTitle: true,
          instructions: true,
          completionRequirementsJson: true,
          conditionalRulesJson: true,
        },
      });
      expect(runtimeTasks).toHaveLength(frozenBefore.slots.length);

      const rtByPackageTaskId = new Map(
        runtimeTasks.map((r) => [r.packageTaskId, r]),
      );

      // Every RuntimeTask must match the FROZEN values, not the mutated live values.
      for (const slot of frozenBefore.slots) {
        const rt = rtByPackageTaskId.get(slot.packageTaskId);
        expect(rt).toBeDefined();
        if (!rt) continue;

        expect(rt.displayTitle).toBe(slot.displayTitle);
        expect(rt.displayTitle.startsWith("MUTATED")).toBe(false);

        expect(rt.instructions ?? null).toEqual(slot.instructions ?? null);
        if (rt.instructions != null) {
          expect(rt.instructions.startsWith("MUTATED")).toBe(false);
        }

        expect(rt.completionRequirementsJson ?? null).toEqual(
          slot.completionRequirementsJson ?? null,
        );
        if (Array.isArray(rt.completionRequirementsJson)) {
          for (const req of rt.completionRequirementsJson as Array<{ label?: unknown }>) {
            const label = typeof req.label === "string" ? req.label : "";
            expect(label.startsWith("MUTATED")).toBe(false);
          }
        }

        expect(rt.conditionalRulesJson ?? null).toEqual(slot.conditionalRulesJson ?? null);
      }
    } finally {
      await cleanupTenant(seed);
    }
  });
});
