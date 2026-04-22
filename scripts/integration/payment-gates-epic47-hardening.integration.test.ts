import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import { activateQuoteVersionForTenant } from "../../src/server/slice1/mutations/activate-quote-version";
import { applyChangeOrderForJob } from "../../src/server/slice1/mutations/apply-change-order";
import { createChangeOrderForJob } from "../../src/server/slice1/mutations/create-change-order";
import { satisfyPaymentGateForTenant } from "../../src/server/slice1/mutations/satisfy-payment-gate";
import { startRuntimeTaskForTenant } from "../../src/server/slice1/mutations/runtime-task-execution";
import { canonicalStringify, sha256HexUtf8 } from "../../src/server/slice1/compose-preview/freeze-snapshots";

describe("Epic 47 payment gate hardening (frozen intent + CO retarget)", () => {
  it("materializes an UNSATISFIED gate from optional paymentGateIntent on first activation only", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pg47-${suffix}`;
    const userId = `user-pg47-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pg47-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QPG-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk-${suffix}`, displayName: "WT" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qvId = `qv-pg47-${suffix}`;
    const pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qvId,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-G1",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-G1"],
          displayTitle: "Gated work",
          lineItemId: "L1",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
      paymentGateIntent: {
        schemaVersion: "paymentGateIntent.v0",
        title: "Deposit hold",
        targetPackageTaskIds: ["PT-G1"],
      },
    };
    const plan = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qvId,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [{ planTaskId: "PL-G1", lineItemId: "L1", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "t", taskKind: "INSTALL", sortKey: "a" }],
    };
    await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg)),
        generatedPlanSnapshot: plan,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(plan)),
      },
    });

    try {
      const act1 = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvId,
        activatedByUserId: userId,
      });
      expect(act1.ok).toBe(true);
      if (!act1.ok) throw new Error("unexpected");

      const gate = await prisma.paymentGate.findFirst({
        where: { quoteVersionId: qvId },
        include: { targets: true },
      });
      expect(gate).not.toBeNull();
      expect(gate!.title).toBe("Deposit hold");
      expect(gate!.status).toBe("UNSATISFIED");
      expect(gate!.targets).toHaveLength(1);
      expect(gate!.targets[0]!.taskKind).toBe("RUNTIME");
      const rt = await prisma.runtimeTask.findFirst({
        where: { quoteVersionId: qvId, packageTaskId: "PT-G1" },
        select: { id: true },
      });
      expect(gate!.targets[0]!.taskId).toBe(rt!.id);

      const act2 = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvId,
        activatedByUserId: userId,
      });
      expect(act2.ok).toBe(true);
      const gates = await prisma.paymentGate.findMany({ where: { quoteVersionId: qvId } });
      expect(gates).toHaveLength(1);
    } finally {
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
      await prisma.paymentGate.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { tenantId } });
      await prisma.flow.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.workflowVersion.deleteMany({ where: { id: wv.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("retargets SATISFIED gate RUNTIME targets by packageTaskId on CO apply; refuses when package slot removed", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pg47co-${suffix}`;
    const userId = `user-pg47co-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `pg47co-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QCO-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tkco-${suffix}`, displayName: "WT" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }, { id: "N2", type: "TASK" }] },
      },
    });

    const qv1Id = `qv1-co-${suffix}`;
    const pkgV1 = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qv1Id,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-A",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-A"],
          displayTitle: "Task A",
          lineItemId: "L1",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
    };
    const planV1 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [{ planTaskId: "PL-A", lineItemId: "L1", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "A", taskKind: "INSTALL", sortKey: "a" }],
    };

    await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
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
      },
    });

    try {
    const act0 = await activateQuoteVersionForTenant(prisma, {
      tenantId,
      quoteVersionId: qv1Id,
      activatedByUserId: userId,
    });
    expect(act0.ok).toBe(true);
    if (!act0.ok) throw new Error("unexpected");

    const flow1Id = act0.data.flowId;
    const rtA = await prisma.runtimeTask.findFirst({
      where: { flowId: flow1Id, packageTaskId: "PT-A" },
      select: { id: true },
    });
    expect(rtA).not.toBeNull();

    await startRuntimeTaskForTenant(prisma, {
      tenantId,
      runtimeTaskId: rtA!.id,
      actorUserId: userId,
      request: {},
    });

    const gate = await prisma.paymentGate.create({
      data: {
        tenantId,
        jobId: act0.data.jobId,
        quoteVersionId: qv1Id,
        title: "Hold on A",
        status: "SATISFIED",
        satisfiedAt: new Date(),
        satisfiedById: userId,
        targets: { create: { taskKind: "RUNTIME", taskId: rtA!.id } },
      },
    });

    const co = await createChangeOrderForJob(prisma, {
      tenantId,
      jobId: act0.data.jobId,
      reason: "add B",
      createdById: userId,
    });
    expect(co.ok).toBe(true);
    if (!co.ok) throw new Error("unexpected");
    const qv2Id = co.data.draftQuoteVersionId;

    const pkgV2 = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qv2Id,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-A",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-A"],
          displayTitle: "Task A",
          lineItemId: "L1",
        },
        {
          packageTaskId: "PT-B",
          nodeId: "N2",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-B"],
          displayTitle: "Task B",
          lineItemId: "L2",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
    };
    const planV2 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv2Id,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [
        { planTaskId: "PL-A", lineItemId: "L1", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "A", taskKind: "INSTALL", sortKey: "a" },
        { planTaskId: "PL-B", lineItemId: "L2", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N2", title: "B", taskKind: "INSTALL", sortKey: "b" },
      ],
    };

    await prisma.quoteVersion.update({
      where: { id: qv2Id },
      data: {
        status: "SIGNED",
        executionPackageSnapshot: pkgV2,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV2)),
        generatedPlanSnapshot: planV2,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV2)),
      },
    });

    const apply1 = await applyChangeOrderForJob(prisma, {
      tenantId,
      changeOrderId: co.data.changeOrderId,
      appliedByUserId: userId,
    });
    expect(apply1.ok).toBe(true);
    if (!apply1.ok) throw new Error(JSON.stringify(apply1));

    const flow2 = await prisma.flow.findFirst({
      where: { quoteVersionId: qv2Id },
      select: { id: true },
    });
    const rtA2 = await prisma.runtimeTask.findFirst({
      where: { flowId: flow2!.id, packageTaskId: "PT-A" },
      select: { id: true },
    });
    expect(rtA2!.id).not.toBe(rtA!.id);

    const tgtAfter = await prisma.paymentGateTarget.findFirst({
      where: { paymentGateId: gate.id },
      select: { taskId: true },
    });
    expect(tgtAfter!.taskId).toBe(rtA2!.id);

    const co2 = await createChangeOrderForJob(prisma, {
      tenantId,
      jobId: act0.data.jobId,
      reason: "remove A",
      createdById: userId,
    });
    expect(co2.ok).toBe(true);
    if (!co2.ok) throw new Error("unexpected");
    const qv3Id = co2.data.draftQuoteVersionId;
    const pkgV3 = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qv3Id,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-B",
          nodeId: "N2",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-B"],
          displayTitle: "Task B only",
          lineItemId: "L2",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
    };
    const planV3 = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv3Id,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [{ planTaskId: "PL-B", lineItemId: "L2", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N2", title: "B", taskKind: "INSTALL", sortKey: "b" }],
    };
    await prisma.quoteVersion.update({
      where: { id: qv3Id },
      data: {
        status: "SIGNED",
        executionPackageSnapshot: pkgV3,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkgV3)),
        generatedPlanSnapshot: planV3,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(planV3)),
      },
    });

    const apply2 = await applyChangeOrderForJob(prisma, {
      tenantId,
      changeOrderId: co2.data.changeOrderId,
      appliedByUserId: userId,
    });
    expect(apply2.ok).toBe(false);
    if (apply2.ok) throw new Error("expected failure");
    expect(apply2.kind).toBe("payment_gate_retarget_failed");
    expect(apply2.unmappedPackageTaskIds).toContain("PT-A");

    const tgtStill = await prisma.paymentGateTarget.findFirst({
      where: { paymentGateId: gate.id },
      select: { taskId: true },
    });
    expect(tgtStill!.taskId).toBe(rtA2!.id);
    } finally {
      await prisma.changeOrder.deleteMany({ where: { tenantId } });
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
      await prisma.paymentGate.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { tenantId } });
      await prisma.flow.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.workflowVersion.deleteMany({ where: { id: wv.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("still blocks CO apply when an UNSATISFIED gate targets a superseded runtime task", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pg47blk-${suffix}`;
    const userId = `user-pg47blk-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `blk-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QB-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tkb-${suffix}`, displayName: "WT" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qv1Id = `qv1b-${suffix}`;
    const pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qv1Id,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-X",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-X"],
          displayTitle: "X",
          lineItemId: "L1",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
    };
    const plan = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qv1Id,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [{ planTaskId: "PL-X", lineItemId: "L1", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "X", taskKind: "INSTALL", sortKey: "a" }],
    };
    await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    await prisma.quoteVersion.create({
      data: {
        id: qv1Id,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg)),
        generatedPlanSnapshot: plan,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(plan)),
      },
    });
    try {
    const act = await activateQuoteVersionForTenant(prisma, {
      tenantId,
      quoteVersionId: qv1Id,
      activatedByUserId: userId,
    });
    expect(act.ok).toBe(true);
    if (!act.ok) throw new Error("unexpected");
    const rt = await prisma.runtimeTask.findFirst({
      where: { flowId: act.data.flowId },
      select: { id: true },
    });
    await prisma.paymentGate.create({
      data: {
        tenantId,
        jobId: act.data.jobId,
        quoteVersionId: qv1Id,
        title: "Unsat",
        status: "UNSATISFIED",
        targets: { create: { taskKind: "RUNTIME", taskId: rt!.id } },
      },
    });
    const co = await createChangeOrderForJob(prisma, {
      tenantId,
      jobId: act.data.jobId,
      reason: "co",
      createdById: userId,
    });
    expect(co.ok).toBe(true);
    if (!co.ok) throw new Error("unexpected");
    const qv2Id = co.data.draftQuoteVersionId;
    const pkg2 = {
      ...pkg,
      quoteVersionId: qv2Id,
      slots: [
        { ...pkg.slots[0], displayTitle: "X2" },
        {
          packageTaskId: "PT-Y",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-Y"],
          displayTitle: "Y",
          lineItemId: "L2",
        },
      ],
    };
    const plan2 = {
      ...plan,
      quoteVersionId: qv2Id,
      rows: [
        ...plan.rows,
        { planTaskId: "PL-Y", lineItemId: "L2", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "Y", taskKind: "INSTALL", sortKey: "b" },
      ],
    };
    await prisma.quoteVersion.update({
      where: { id: qv2Id },
      data: {
        status: "SIGNED",
        executionPackageSnapshot: pkg2,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg2)),
        generatedPlanSnapshot: plan2,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(plan2)),
      },
    });
    const apply = await applyChangeOrderForJob(prisma, {
      tenantId,
      changeOrderId: co.data.changeOrderId,
      appliedByUserId: userId,
    });
    expect(apply.ok).toBe(false);
    if (apply.ok) throw new Error("unexpected");
    expect(apply.kind).toBe("payment_gate_block");
    } finally {
      await prisma.changeOrder.deleteMany({ where: { tenantId } });
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
      await prisma.paymentGate.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { tenantId } });
      await prisma.flow.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.workflowVersion.deleteMany({ where: { id: wv.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });

  it("enforces start blocking on materialized gate from frozen intent", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `pg47st-${suffix}`;
    const userId = `user-pg47st-${suffix}`;
    await prisma.tenant.create({ data: { id: tenantId, name: "T" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `st-${suffix}@t.com`, role: "OFFICE_ADMIN" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QS-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tks-${suffix}`, displayName: "WT" },
    });
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson: { nodes: [{ id: "N1", type: "TASK" }] },
      },
    });
    const qvId = `qv-st-${suffix}`;
    const pkg = {
      schemaVersion: "executionPackageSnapshot.v0",
      quoteVersionId: qvId,
      pinnedWorkflowVersionId: wv.id,
      composedAt: new Date().toISOString(),
      slots: [
        {
          packageTaskId: "PT-S",
          nodeId: "N1",
          source: "SOLD_SCOPE",
          planTaskIds: ["PL-S"],
          displayTitle: "S",
          lineItemId: "L1",
        },
      ],
      diagnostics: { errors: [], warnings: [] },
      paymentGateIntent: {
        schemaVersion: "paymentGateIntent.v0",
        title: "Pay first",
        targetPackageTaskIds: ["PT-S"],
      },
    };
    const plan = {
      schemaVersion: "generatedPlanSnapshot.v0",
      quoteVersionId: qvId,
      pinnedWorkflowVersionId: wv.id,
      generatedAt: new Date().toISOString(),
      rows: [{ planTaskId: "PL-S", lineItemId: "L1", scopeSource: "SOLD_SCOPE", quantityIndex: 0, targetNodeKey: "N1", title: "S", taskKind: "INSTALL", sortKey: "a" }],
    };
    await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
        executionPackageSnapshot: pkg,
        packageSnapshotSha256: sha256HexUtf8(canonicalStringify(pkg)),
        generatedPlanSnapshot: plan,
        planSnapshotSha256: sha256HexUtf8(canonicalStringify(plan)),
      },
    });
    try {
      const act = await activateQuoteVersionForTenant(prisma, {
        tenantId,
        quoteVersionId: qvId,
        activatedByUserId: userId,
      });
      expect(act.ok).toBe(true);
      if (!act.ok) throw new Error("unexpected");
      const rt = await prisma.runtimeTask.findFirst({
        where: { quoteVersionId: qvId },
        select: { id: true },
      });
      const startBlocked = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rt!.id,
        actorUserId: userId,
        request: {},
      });
      expect(startBlocked.ok).toBe(false);
      if (startBlocked.ok) throw new Error("expected block");
      expect(startBlocked.kind).toBe("payment_gate_unsatisfied");

      const gate = await prisma.paymentGate.findFirst({ where: { quoteVersionId: qvId }, select: { id: true } });
      const sat = await satisfyPaymentGateForTenant(prisma, {
        tenantId,
        paymentGateId: gate!.id,
        actorUserId: userId,
      });
      expect(sat.ok).toBe(true);

      const startOk = await startRuntimeTaskForTenant(prisma, {
        tenantId,
        runtimeTaskId: rt!.id,
        actorUserId: userId,
        request: {},
      });
      expect(startOk.ok).toBe(true);
    } finally {
      await prisma.paymentGateTarget.deleteMany({ where: { paymentGate: { tenantId } } });
      await prisma.paymentGate.deleteMany({ where: { tenantId } });
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
      await prisma.runtimeTask.deleteMany({ where: { tenantId } });
      await prisma.activation.deleteMany({ where: { tenantId } });
      await prisma.flow.deleteMany({ where: { tenantId } });
      await prisma.job.deleteMany({ where: { tenantId } });
      await prisma.quoteVersion.deleteMany({ where: { quoteId: quote.id } });
      await prisma.quote.deleteMany({ where: { id: quote.id } });
      await prisma.workflowVersion.deleteMany({ where: { id: wv.id } });
      await prisma.workflowTemplate.deleteMany({ where: { id: wt.id } });
      await prisma.flowGroup.deleteMany({ where: { id: fg.id } });
      await prisma.customer.deleteMany({ where: { id: customer.id } });
      await prisma.user.deleteMany({ where: { id: userId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
