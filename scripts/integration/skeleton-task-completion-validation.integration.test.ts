import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  completeSkeletonTaskForTenant,
  startSkeletonTaskForTenant,
} from "../../src/server/slice1/mutations/skeleton-task-execution";

describe("skeleton task completion validation parity (Epic 27 / 26)", () => {
  it("rejects complete when a baseline required field is missing", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `skval-${suffix}`;
    const userId = `user-skval-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "SK Val" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `skval-${suffix}@t.com`, role: "FIELD_WORKER" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QSK-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk-${suffix}`, displayName: "T" },
    });
    const snapshotJson = {
      nodes: [
        {
          id: "N1",
          tasks: [
            {
              id: "SK-R1",
              title: "Skeleton with required result",
              completionRequirementsJson: [{ kind: "result", required: true }],
              conditionalRulesJson: [],
            },
          ],
        },
      ],
    };
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson,
      },
    });
    const qvId = `qv-skval-${suffix}`;
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qvId,
        packageSnapshotSha256: "x",
        activatedById: userId,
      },
    });

    try {
      const st = await startSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-R1",
        actorUserId: userId,
        request: {},
      });
      expect(st.ok).toBe(true);

      const bad = await completeSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-R1",
        actorUserId: userId,
        request: { completionProof: { overallResult: null } },
      });
      expect(bad.ok).toBe(false);
      if (bad.ok) throw new Error("expected failure");
      expect(bad.kind).toBe("validation_failed");
      expect(bad.errors.some((e) => e.field === "overallResult")).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
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

  it("rejects complete when a conditional required field is missing", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `skval2-${suffix}`;
    const userId = `user-skval2-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "SK Val2" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `skval2-${suffix}@t.com`, role: "FIELD_WORKER" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QSK2-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk2-${suffix}`, displayName: "T" },
    });
    const snapshotJson = {
      nodes: [
        {
          id: "N1",
          tasks: [
            {
              id: "SK-C1",
              title: "Conditional note",
              completionRequirementsJson: [],
              conditionalRulesJson: [
                {
                  trigger: { kind: "result", value: "FAIL" },
                  require: { kind: "note", message: "Explain the failure" },
                },
              ],
            },
          ],
        },
      ],
    };
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson,
      },
    });
    const qvId = `qv-skval2-${suffix}`;
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qvId,
        packageSnapshotSha256: "x",
        activatedById: userId,
      },
    });

    try {
      await startSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-C1",
        actorUserId: userId,
        request: {},
      });

      const bad = await completeSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-C1",
        actorUserId: userId,
        request: {
          completionProof: { overallResult: "FAIL", note: "   " },
        },
      });
      expect(bad.ok).toBe(false);
      if (bad.ok) throw new Error("expected failure");
      expect(bad.kind).toBe("validation_failed");
      expect(bad.errors.some((e) => e.field === "note")).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
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

  it("allows complete when baseline required fields are satisfied", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `skval3-${suffix}`;
    const userId = `user-skval3-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "SK Val3" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `skval3-${suffix}@t.com`, role: "FIELD_WORKER" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QSK3-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk3-${suffix}`, displayName: "T" },
    });
    const snapshotJson = {
      nodes: [
        {
          id: "N1",
          tasks: [
            {
              id: "SK-OK",
              title: "Baseline only",
              completionRequirementsJson: [{ kind: "result", required: true }],
              conditionalRulesJson: [],
            },
          ],
        },
      ],
    };
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson,
      },
    });
    const qvId = `qv-skval3-${suffix}`;
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qvId,
        packageSnapshotSha256: "x",
        activatedById: userId,
      },
    });

    try {
      await startSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-OK",
        actorUserId: userId,
        request: {},
      });

      const okPass = await completeSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-OK",
        actorUserId: userId,
        request: { completionProof: { overallResult: "PASS" } },
      });
      expect(okPass.ok).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
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

  it("allows complete when conditional required fields are satisfied", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `skval4-${suffix}`;
    const userId = `user-skval4-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "SK Val4" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `skval4-${suffix}@t.com`, role: "FIELD_WORKER" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QSK4-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tk4-${suffix}`, displayName: "T" },
    });
    const snapshotJson = {
      nodes: [
        {
          id: "N1",
          tasks: [
            {
              id: "SK-COK",
              title: "Conditional ok",
              completionRequirementsJson: [],
              conditionalRulesJson: [
                {
                  trigger: { kind: "result", value: "FAIL" },
                  require: { kind: "note", message: "Explain the failure" },
                },
              ],
            },
          ],
        },
      ],
    };
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson,
      },
    });
    const qvId = `qv-skval4-${suffix}`;
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qvId,
        packageSnapshotSha256: "x",
        activatedById: userId,
      },
    });

    try {
      await startSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-COK",
        actorUserId: userId,
        request: {},
      });

      const ok = await completeSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-COK",
        actorUserId: userId,
        request: {
          completionProof: { overallResult: "FAIL", note: "Documented customer rejection." },
        },
      });
      expect(ok.ok).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
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

  it("allows complete with empty proof when snapshot task has no authored requirements (seed-style)", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `skval-plain-${suffix}`;
    const userId = `user-skval-plain-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "SK Plain" } });
    await prisma.user.create({
      data: { id: userId, tenantId, email: `skval-plain-${suffix}@t.com`, role: "FIELD_WORKER" },
    });
    const customer = await prisma.customer.create({ data: { tenantId, name: "C" } });
    const fg = await prisma.flowGroup.create({ data: { tenantId, customerId: customer.id, name: "FG" } });
    const quote = await prisma.quote.create({
      data: { tenantId, customerId: customer.id, flowGroupId: fg.id, quoteNumber: `QSKP-${suffix}` },
    });
    const wt = await prisma.workflowTemplate.create({
      data: { tenantId, templateKey: `tkp-${suffix}`, displayName: "T" },
    });
    const snapshotJson = {
      nodes: [{ id: "N1", tasks: [{ id: "SK-PLAIN", title: "Plain skeleton" }] }],
    };
    const wv = await prisma.workflowVersion.create({
      data: {
        workflowTemplateId: wt.id,
        versionNumber: 1,
        status: "PUBLISHED",
        publishedAt: new Date(),
        snapshotJson,
      },
    });
    const qvId = `qv-skval-plain-${suffix}`;
    await prisma.quoteVersion.create({
      data: {
        id: qvId,
        quoteId: quote.id,
        versionNumber: 1,
        status: "SIGNED",
        createdById: userId,
        pinnedWorkflowVersionId: wv.id,
      },
    });
    const job = await prisma.job.create({ data: { tenantId, flowGroupId: fg.id } });
    const flow = await prisma.flow.create({
      data: { tenantId, jobId: job.id, quoteVersionId: qvId, workflowVersionId: wv.id },
    });
    await prisma.activation.create({
      data: {
        tenantId,
        jobId: job.id,
        flowId: flow.id,
        quoteVersionId: qvId,
        packageSnapshotSha256: "x",
        activatedById: userId,
      },
    });

    try {
      await startSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-PLAIN",
        actorUserId: userId,
        request: {},
      });
      const ok = await completeSkeletonTaskForTenant(prisma, {
        tenantId,
        flowId: flow.id,
        skeletonTaskId: "SK-PLAIN",
        actorUserId: userId,
        request: {},
      });
      expect(ok.ok).toBe(true);
    } finally {
      await prisma.taskExecution.deleteMany({ where: { tenantId } });
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
