import { describe, expect, it } from "vitest";
import { getPrisma } from "../../src/server/db/prisma";
import {
  createTaskDefinitionForTenant,
  setTaskDefinitionStatusForTenant,
  updateTaskDefinitionForTenant,
} from "../../src/server/slice1/mutations/task-definition-mutations";

/**
 * Office TaskDefinition authoring slice — covers the smallest production
 * invariants that the office surface now drives via `/api/task-definitions`:
 *   1. tenant-scoped create + tenant isolation across two tenants
 *   2. unique `taskKey` collision per tenant
 *   3. DRAFT-only content edit guard (PUBLISHED rejects content patch)
 *   4. status transition unlocks edit (PUBLISHED → DRAFT lets content change)
 *
 * The mutations themselves are surface-agnostic — the office UI and the dev UI
 * both call them through the same API route, so this coverage is sufficient
 * for either entry point.
 */
describe("task definition mutations — tenant scope + DRAFT-only edit guard", () => {
  it("creates DRAFT, isolates by tenant, rejects taskKey collision", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantA = `td-a-${suffix}`;
    const tenantB = `td-b-${suffix}`;
    const sharedKey = `tk-shared-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantA, name: "TD A" } });
    await prisma.tenant.create({ data: { id: tenantB, name: "TD B" } });

    try {
      const created = await createTaskDefinitionForTenant(prisma, {
        tenantId: tenantA,
        taskKey: sharedKey,
        displayName: "Tenant A reusable",
        instructions: "  do the thing  ",
        completionRequirements: [
          { kind: "checklist", label: "verified ground", required: true },
        ],
        conditionalRules: [],
      });

      expect(created.status).toBe("DRAFT");
      expect(created.taskKey).toBe(sharedKey);
      expect(created.displayName).toBe("Tenant A reusable");
      expect(created.instructions).toBe("do the thing");
      expect(created.requirementsCount).toBe(1);

      // Same key on a *different* tenant must succeed (tenant scope).
      const createdB = await createTaskDefinitionForTenant(prisma, {
        tenantId: tenantB,
        taskKey: sharedKey,
        displayName: "Tenant B reusable",
        completionRequirements: [],
        conditionalRules: [],
      });
      expect(createdB.id).not.toBe(created.id);

      // Same tenant + same key must collide (unique([tenantId, taskKey])).
      await expect(
        createTaskDefinitionForTenant(prisma, {
          tenantId: tenantA,
          taskKey: sharedKey,
          displayName: "duplicate attempt",
          completionRequirements: [],
          conditionalRules: [],
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_TASK_KEY_TAKEN" });

      // Tenant A cannot reach tenant B's row even with the same id (defense-in-depth).
      await expect(
        updateTaskDefinitionForTenant(prisma, {
          tenantId: tenantA,
          taskDefinitionId: createdB.id,
          displayName: "cross-tenant attempt",
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_NOT_FOUND" });
    } finally {
      await prisma.taskDefinition.deleteMany({ where: { tenantId: { in: [tenantA, tenantB] } } });
      await prisma.tenant.deleteMany({ where: { id: { in: [tenantA, tenantB] } } });
    }
  });

  it("blocks content edit on PUBLISHED, allows after PUBLISHED→DRAFT transition", async () => {
    const prisma = getPrisma();
    const suffix = Math.random().toString(36).slice(2, 10);
    const tenantId = `td-edit-${suffix}`;

    await prisma.tenant.create({ data: { id: tenantId, name: "TD Edit" } });

    try {
      const created = await createTaskDefinitionForTenant(prisma, {
        tenantId,
        taskKey: `tk-edit-${suffix}`,
        displayName: "Editable thing",
        completionRequirements: [
          { kind: "checklist", label: "first check", required: true },
        ],
        conditionalRules: [],
      });

      // Publish.
      const published = await setTaskDefinitionStatusForTenant(prisma, {
        tenantId,
        taskDefinitionId: created.id,
        nextStatus: "PUBLISHED",
      });
      expect(published.status).toBe("PUBLISHED");

      // Content patch on PUBLISHED is rejected by `assertEditableStatus`.
      await expect(
        updateTaskDefinitionForTenant(prisma, {
          tenantId,
          taskDefinitionId: created.id,
          displayName: "should be blocked",
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_NOT_DRAFT" });

      await expect(
        updateTaskDefinitionForTenant(prisma, {
          tenantId,
          taskDefinitionId: created.id,
          completionRequirements: [
            { kind: "checklist", label: "second check", required: true },
          ],
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_NOT_DRAFT" });

      // PUBLISHED → DRAFT (status-only transition) is allowed and idempotent.
      const reopened = await setTaskDefinitionStatusForTenant(prisma, {
        tenantId,
        taskDefinitionId: created.id,
        nextStatus: "DRAFT",
      });
      expect(reopened.status).toBe("DRAFT");

      // Now content patches succeed again — the editor surface re-opens cleanly.
      const edited = await updateTaskDefinitionForTenant(prisma, {
        tenantId,
        taskDefinitionId: created.id,
        displayName: "Now allowed",
        completionRequirements: [
          { kind: "checklist", label: "first check", required: true },
          { kind: "note", required: true },
        ],
      });
      expect(edited.displayName).toBe("Now allowed");
      expect(edited.requirementsCount).toBe(2);

      // Invalid status transition (ARCHIVED is terminal).
      await setTaskDefinitionStatusForTenant(prisma, {
        tenantId,
        taskDefinitionId: created.id,
        nextStatus: "ARCHIVED",
      });
      await expect(
        setTaskDefinitionStatusForTenant(prisma, {
          tenantId,
          taskDefinitionId: created.id,
          nextStatus: "DRAFT",
        }),
      ).rejects.toMatchObject({ code: "TASK_DEFINITION_INVALID_STATUS_TRANSITION" });
    } finally {
      await prisma.taskDefinition.deleteMany({ where: { tenantId } });
      await prisma.tenant.deleteMany({ where: { id: tenantId } });
    }
  });
});
