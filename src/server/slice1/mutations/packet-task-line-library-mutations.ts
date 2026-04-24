import { Prisma, type PrismaClient } from "@prisma/client";
import {
  assertLineKey,
  assertOptionalTierCode,
  assertSortOrder,
  assertTargetNodeKey,
} from "@/lib/quote-local-packet-input";
import { InvariantViolationError } from "../errors";

function assertEmbeddedLineTitle(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new InvariantViolationError(
      "INVALID_LINE_TITLE",
      "title must be a non-empty string.",
      {},
    );
  }
  return raw.trim();
}

function buildEmbeddedPayload(title: string, taskKind: string | null): Record<string, unknown> {
  const o: Record<string, unknown> = { title };
  if (taskKind != null && taskKind.trim() !== "") {
    o.taskKind = taskKind.trim();
  }
  return o;
}

export type CreateEmbeddedLibraryPacketTaskLineInput = {
  tenantId: string;
  /** Reserved for future audit columns. */
  userId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  lineKey: unknown;
  targetNodeKey: unknown;
  /** Display title stored in `embeddedPayloadJson.title` (publish readiness requires non-empty embedded meaning). */
  title: unknown;
  /** Optional compose-facing task kind (e.g. INSTALL, LABOR). */
  taskKind?: unknown;
  tierCode?: unknown;
  sortOrder?: unknown;
};

export type CreateLibraryRefPacketTaskLineInput = {
  tenantId: string;
  userId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  lineKey: unknown;
  targetNodeKey: unknown;
  /** Catalog TaskDefinition id; must belong to tenant and be PUBLISHED. */
  taskDefinitionId: unknown;
  tierCode?: unknown;
  sortOrder?: unknown;
};

const EMPTY_LIB_EMBEDDED: Prisma.InputJsonValue = {};

/**
 * Add one **LIBRARY** `PacketTaskLine` (published `TaskDefinition` ref) to a **DRAFT** revision.
 * `embeddedPayloadJson` is `{}` per canon NOT-NULL contract for LIBRARY rows (see packet-promotion-mapping).
 */
export async function createLibraryRefPacketTaskLineForLibraryDraftRevision(
  prisma: PrismaClient,
  input: CreateLibraryRefPacketTaskLineInput,
): Promise<{ id: string; lineKey: string; sortOrder: number } | "not_found"> {
  const rev = await prisma.scopePacketRevision.findFirst({
    where: {
      id: input.scopePacketRevisionId,
      scopePacketId: input.scopePacketId,
      scopePacket: { tenantId: input.tenantId },
    },
    select: { id: true, status: true },
  });
  if (!rev) return "not_found";

  if (rev.status !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT",
      "Packet task lines can only be added to a DRAFT ScopePacketRevision.",
      { scopePacketRevisionId: rev.id, status: rev.status },
    );
  }

  const tdRaw = input.taskDefinitionId;
  if (typeof tdRaw !== "string" || tdRaw.trim() === "") {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_FOUND",
      "taskDefinitionId must be a non-empty string.",
      {},
    );
  }
  const taskDefinitionId = tdRaw.trim();

  const taskDefinition = await prisma.taskDefinition.findFirst({
    where: { id: taskDefinitionId, tenantId: input.tenantId },
    select: { id: true, status: true },
  });
  if (!taskDefinition) {
    throw new InvariantViolationError(
      "TASK_DEFINITION_NOT_FOUND",
      "TaskDefinition not found for this tenant.",
      { taskDefinitionId },
    );
  }
  if (taskDefinition.status !== "PUBLISHED") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_TASK_DEFINITION_NOT_PUBLISHED",
      "Only PUBLISHED catalog task definitions may be placed on a LIBRARY packet task line.",
      { taskDefinitionId: taskDefinition.id, status: taskDefinition.status },
    );
  }

  const lineKey = assertLineKey(input.lineKey);
  const targetNodeKey = assertTargetNodeKey(input.targetNodeKey);
  const tierCode = assertOptionalTierCode(input.tierCode);

  let sortOrder: number;
  if (input.sortOrder === undefined || input.sortOrder === null) {
    const agg = await prisma.packetTaskLine.aggregate({
      where: { scopePacketRevisionId: rev.id },
      _max: { sortOrder: true },
    });
    sortOrder = (agg._max.sortOrder ?? -1) + 1;
  } else {
    sortOrder = assertSortOrder(input.sortOrder);
  }

  try {
    return await prisma.packetTaskLine.create({
      data: {
        scopePacketRevisionId: rev.id,
        lineKey,
        sortOrder,
        tierCode,
        lineKind: "LIBRARY",
        embeddedPayloadJson: EMPTY_LIB_EMBEDDED,
        taskDefinitionId: taskDefinition.id,
        targetNodeKey,
      },
      select: { id: true, lineKey: true, sortOrder: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "SCOPE_PACKET_TASK_LINE_LINE_KEY_TAKEN",
        "This lineKey is already used on this revision.",
        { lineKey },
      );
    }
    throw e;
  }
}

/**
 * Add one **EMBEDDED** `PacketTaskLine` to a **DRAFT** library revision (Epic 16).
 * LIBRARY lines use `createLibraryRefPacketTaskLineForLibraryDraftRevision`.
 */
export async function createEmbeddedPacketTaskLineForLibraryDraftRevision(
  prisma: PrismaClient,
  input: CreateEmbeddedLibraryPacketTaskLineInput,
): Promise<{ id: string; lineKey: string; sortOrder: number } | "not_found"> {
  const rev = await prisma.scopePacketRevision.findFirst({
    where: {
      id: input.scopePacketRevisionId,
      scopePacketId: input.scopePacketId,
      scopePacket: { tenantId: input.tenantId },
    },
    select: { id: true, status: true },
  });
  if (!rev) return "not_found";

  if (rev.status !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT",
      "Packet task lines can only be added to a DRAFT ScopePacketRevision.",
      { scopePacketRevisionId: rev.id, status: rev.status },
    );
  }

  const lineKey = assertLineKey(input.lineKey);
  const targetNodeKey = assertTargetNodeKey(input.targetNodeKey);
  const tierCode = assertOptionalTierCode(input.tierCode);
  const title = assertEmbeddedLineTitle(input.title);
  const tk = input.taskKind;
  const taskKind =
    tk === undefined || tk === null || typeof tk !== "string" ? null : tk.trim() || null;

  let sortOrder: number;
  if (input.sortOrder === undefined || input.sortOrder === null) {
    const agg = await prisma.packetTaskLine.aggregate({
      where: { scopePacketRevisionId: rev.id },
      _max: { sortOrder: true },
    });
    sortOrder = (agg._max.sortOrder ?? -1) + 1;
  } else {
    sortOrder = assertSortOrder(input.sortOrder);
  }

  const embeddedPayloadJson = buildEmbeddedPayload(title, taskKind);

  try {
    return await prisma.packetTaskLine.create({
      data: {
        scopePacketRevisionId: rev.id,
        lineKey,
        sortOrder,
        tierCode,
        lineKind: "EMBEDDED",
        embeddedPayloadJson: embeddedPayloadJson as Prisma.InputJsonValue,
        taskDefinitionId: null,
        targetNodeKey,
      },
      select: { id: true, lineKey: true, sortOrder: true },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "SCOPE_PACKET_TASK_LINE_LINE_KEY_TAKEN",
        "This lineKey is already used on this revision.",
        { lineKey },
      );
    }
    throw e;
  }
}

export type DeleteLibraryPacketTaskLineInput = {
  tenantId: string;
  userId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
};

/** Delete a task line from a **DRAFT** library revision only. */
export async function deletePacketTaskLineForLibraryDraftRevision(
  prisma: PrismaClient,
  input: DeleteLibraryPacketTaskLineInput,
): Promise<"ok" | "not_found"> {
  const line = await prisma.packetTaskLine.findFirst({
    where: {
      id: input.packetTaskLineId,
      scopePacketRevision: {
        id: input.scopePacketRevisionId,
        scopePacketId: input.scopePacketId,
        scopePacket: { tenantId: input.tenantId },
      },
    },
    select: { id: true, scopePacketRevision: { select: { status: true } } },
  });
  if (!line) return "not_found";

  if (line.scopePacketRevision.status !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT",
      "Packet task lines can only be deleted from a DRAFT ScopePacketRevision.",
      {
        scopePacketRevisionId: input.scopePacketRevisionId,
        status: line.scopePacketRevision.status,
      },
    );
  }

  await prisma.packetTaskLine.delete({ where: { id: line.id } });
  return "ok";
}

export type UpdatePacketTaskLinePatch = {
  targetNodeKey?: unknown;
  tierCode?: unknown;
  title?: unknown;
  taskKind?: unknown;
};

export type UpdatePacketTaskLineForLibraryDraftRevisionInput = {
  tenantId: string;
  userId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  patch: UpdatePacketTaskLinePatch;
};

function cloneEmbeddedPayloadObject(existingJson: unknown): Record<string, unknown> {
  if (
    existingJson !== null &&
    typeof existingJson === "object" &&
    !Array.isArray(existingJson)
  ) {
    return { ...(existingJson as Record<string, unknown>) };
  }
  return {};
}

/**
 * Merge **EMBEDDED** payload updates; only keys present in `partial` are applied.
 */
function mergeEmbeddedPayloadForLineUpdate(
  existingJson: unknown,
  partial: { title?: unknown; taskKind?: unknown },
): Prisma.InputJsonValue {
  const base = cloneEmbeddedPayloadObject(existingJson);
  if ("title" in partial) {
    base.title = assertEmbeddedLineTitle(partial.title);
  }
  if ("taskKind" in partial) {
    const tk = partial.taskKind;
    if (tk === null) {
      delete base.taskKind;
    } else if (typeof tk === "string") {
      const t = tk.trim();
      if (t === "") delete base.taskKind;
      else base.taskKind = t;
    } else {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD",
        "taskKind must be a string, null, or omitted.",
        {},
      );
    }
  }
  return base as Prisma.InputJsonValue;
}

/**
 * Bounded field updates on a **DRAFT** revision `PacketTaskLine` (Epic 16 narrow slice).
 * Allowed: `targetNodeKey`, optional `tierCode` (both kinds); `title` + optional `taskKind` (**EMBEDDED** only).
 */
export async function updatePacketTaskLineForLibraryDraftRevision(
  prisma: PrismaClient,
  input: UpdatePacketTaskLineForLibraryDraftRevisionInput,
): Promise<"ok" | "not_found"> {
  const patch = input.patch;
  const keys = Object.keys(patch) as (keyof UpdatePacketTaskLinePatch)[];
  if (keys.length === 0) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_EDIT_EMPTY_PATCH",
      "Provide at least one field to update (targetNodeKey, tierCode, and for EMBEDDED lines title or taskKind).",
      {},
    );
  }

  const line = await prisma.packetTaskLine.findFirst({
    where: {
      id: input.packetTaskLineId,
      scopePacketRevision: {
        id: input.scopePacketRevisionId,
        scopePacketId: input.scopePacketId,
        scopePacket: { tenantId: input.tenantId },
      },
    },
    select: {
      id: true,
      lineKind: true,
      embeddedPayloadJson: true,
      targetNodeKey: true,
      tierCode: true,
      scopePacketRevision: { select: { status: true } },
    },
  });
  if (!line) return "not_found";

  if (line.scopePacketRevision.status !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT",
      "Packet task lines can only be edited on a DRAFT ScopePacketRevision.",
      {
        scopePacketRevisionId: input.scopePacketRevisionId,
        status: line.scopePacketRevision.status,
      },
    );
  }

  if (line.lineKind === "LIBRARY" && ("title" in patch || "taskKind" in patch)) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_EDIT_EMBEDDED_FIELDS_ON_LIBRARY",
      "title and taskKind may only be updated on EMBEDDED packet task lines.",
      { packetTaskLineId: line.id },
    );
  }

  const data: Prisma.PacketTaskLineUpdateInput = {};

  if ("targetNodeKey" in patch) {
    data.targetNodeKey = assertTargetNodeKey(patch.targetNodeKey);
  }
  if ("tierCode" in patch) {
    data.tierCode = assertOptionalTierCode(patch.tierCode);
  }

  if (line.lineKind === "EMBEDDED" && ("title" in patch || "taskKind" in patch)) {
    data.embeddedPayloadJson = mergeEmbeddedPayloadForLineUpdate(line.embeddedPayloadJson, {
      ...("title" in patch ? { title: patch.title } : {}),
      ...("taskKind" in patch ? { taskKind: patch.taskKind } : {}),
    });
  }

  if (Object.keys(data).length === 0) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_EDIT_EMPTY_PATCH",
      "No valid updates after applying the patch (check field names).",
      {},
    );
  }

  await prisma.packetTaskLine.update({
    where: { id: line.id },
    data,
  });

  return "ok";
}

export type ReorderPacketTaskLineDirection = "up" | "down";

export type ReorderPacketTaskLineSortOrderInput = {
  tenantId: string;
  userId: string;
  scopePacketId: string;
  scopePacketRevisionId: string;
  packetTaskLineId: string;
  direction: ReorderPacketTaskLineDirection;
};

/**
 * Move one line **up** or **down** in the canonical list order (`sortOrder` asc, `lineKey` asc),
 * then **renumber** `sortOrder` to `0..n-1` so order stays deterministic (handles legacy duplicate sortOrder).
 * **DRAFT** revision only; does not mutate line keys, payloads, or task-definition refs.
 */
export async function reorderPacketTaskLineSortOrderForLibraryDraftRevision(
  prisma: PrismaClient,
  input: ReorderPacketTaskLineSortOrderInput,
): Promise<"ok" | "not_found"> {
  const rev = await prisma.scopePacketRevision.findFirst({
    where: {
      id: input.scopePacketRevisionId,
      scopePacketId: input.scopePacketId,
      scopePacket: { tenantId: input.tenantId },
    },
    select: { id: true, status: true },
  });
  if (!rev) return "not_found";

  if (rev.status !== "DRAFT") {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT",
      "Packet task lines can only be reordered on a DRAFT ScopePacketRevision.",
      { scopePacketRevisionId: rev.id, status: rev.status },
    );
  }

  const lines = await prisma.packetTaskLine.findMany({
    where: { scopePacketRevisionId: rev.id },
    orderBy: [{ sortOrder: "asc" }, { lineKey: "asc" }],
    select: { id: true },
  });

  const idx = lines.findIndex((l) => l.id === input.packetTaskLineId);
  if (idx < 0) return "not_found";

  const dir = input.direction;

  if (dir === "up" && idx === 0) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_REORDER_AT_BOUNDARY",
      "This line is already first in sort order.",
      { packetTaskLineId: input.packetTaskLineId, direction: dir },
    );
  }
  if (dir === "down" && idx === lines.length - 1) {
    throw new InvariantViolationError(
      "SCOPE_PACKET_TASK_LINE_REORDER_AT_BOUNDARY",
      "This line is already last in sort order.",
      { packetTaskLineId: input.packetTaskLineId, direction: dir },
    );
  }

  const j = dir === "up" ? idx - 1 : idx + 1;
  const nextOrder = lines.map((l) => l.id);
  const tmp = nextOrder[idx]!;
  nextOrder[idx] = nextOrder[j]!;
  nextOrder[j] = tmp;

  await prisma.$transaction(
    nextOrder.map((id, sortOrder) =>
      prisma.packetTaskLine.update({
        where: { id },
        data: { sortOrder },
      }),
    ),
  );

  return "ok";
}
