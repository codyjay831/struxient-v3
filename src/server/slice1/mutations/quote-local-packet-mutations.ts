import { Prisma, type PrismaClient } from "@prisma/client";
import { InvariantViolationError } from "../errors";
import { assertQuoteVersionDraft } from "../invariants/quote-version";
import { assertQuoteLocalPacketTenantMatchesQuote } from "../invariants/quote-local-packet";
import { assertQuoteLocalPacketItemLineKindPayload } from "../invariants/quote-local-packet-item";
import { bumpComposePreviewStalenessToken } from "./compose-staleness";
import {
  assertDisplayName,
  assertOptionalDescription,
  assertLineKey,
  assertSortOrder,
  assertOptionalTierCode,
  assertTargetNodeKey,
  assertLineKind,
  assertOptionalEmbeddedPayload,
  assertOptionalTaskDefinitionId,
} from "@/lib/quote-local-packet-input";
import {
  getQuoteLocalPacketForTenant,
  type QuoteLocalPacketDto,
} from "../reads/quote-local-packet-reads";

/**
 * Quote-local packet authoring mutations.
 *
 * - DRAFT QuoteVersion only (re-uses assertQuoteVersionDraft).
 * - Tenant-scoped throughout: returns "not_found" for any cross-tenant probe.
 * - Each write bumps the compose-preview staleness token.
 * - Honors existing invariants: tenant/quote-version match, LIBRARY/EMBEDDED payload rule.
 *
 * Out of scope (future slices): TaskDefinition picker UI, promotion flow,
 * targetNodeKey pre-validation against pinned workflow snapshot, fork-from-library.
 *
 * Canon refs: docs/canon/05-packet-canon.md, docs/epics/15-scope-packets-epic.md,
 * docs/epics/16-packet-task-lines-epic.md.
 */

type DraftLoad =
  | { ok: true; quoteVersionId: string; tenantId: string; userId: string }
  | { ok: false; kind: "not_found" };

async function loadDraftVersionForActor(
  client: PrismaClient,
  params: { tenantId: string; quoteVersionId: string; userId: string },
): Promise<DraftLoad> {
  const qv = await client.quoteVersion.findFirst({
    where: { id: params.quoteVersionId, quote: { tenantId: params.tenantId } },
    select: { id: true, status: true, quote: { select: { tenantId: true } } },
  });
  if (!qv) return { ok: false, kind: "not_found" };
  assertQuoteVersionDraft({ status: qv.status, quoteVersionId: qv.id });
  return {
    ok: true,
    quoteVersionId: qv.id,
    tenantId: qv.quote.tenantId,
    userId: params.userId,
  };
}

async function loadDraftPacketForActor(
  client: PrismaClient,
  params: { tenantId: string; quoteLocalPacketId: string; userId: string },
): Promise<
  | {
      ok: true;
      packetId: string;
      tenantId: string;
      quoteVersionId: string;
      userId: string;
    }
  | { ok: false; kind: "not_found" }
> {
  const row = await client.quoteLocalPacket.findFirst({
    where: {
      id: params.quoteLocalPacketId,
      tenantId: params.tenantId,
      quoteVersion: { quote: { tenantId: params.tenantId } },
    },
    select: {
      id: true,
      tenantId: true,
      quoteVersionId: true,
      quoteVersion: { select: { id: true, status: true, quote: { select: { tenantId: true } } } },
    },
  });
  if (!row) return { ok: false, kind: "not_found" };
  assertQuoteVersionDraft({
    status: row.quoteVersion.status,
    quoteVersionId: row.quoteVersionId,
  });
  assertQuoteLocalPacketTenantMatchesQuote({
    packetTenantId: row.tenantId,
    packetQuoteVersionId: row.quoteVersionId,
    quoteTenantId: row.quoteVersion.quote.tenantId,
    quoteVersionId: row.quoteVersionId,
    quoteLocalPacketId: row.id,
  });
  return {
    ok: true,
    packetId: row.id,
    tenantId: row.tenantId,
    quoteVersionId: row.quoteVersionId,
    userId: params.userId,
  };
}

/* ───────────────────────────── Packet CRUD ───────────────────────────── */

export type CreateQuoteLocalPacketInput = {
  tenantId: string;
  quoteVersionId: string;
  userId: string;
  displayName: unknown;
  description?: unknown;
};

export async function createQuoteLocalPacketForTenant(
  prisma: PrismaClient,
  input: CreateQuoteLocalPacketInput,
): Promise<QuoteLocalPacketDto | "not_found"> {
  const draft = await loadDraftVersionForActor(prisma, {
    tenantId: input.tenantId,
    quoteVersionId: input.quoteVersionId,
    userId: input.userId,
  });
  if (!draft.ok) return "not_found";

  const displayName = assertDisplayName(input.displayName);
  const description = assertOptionalDescription(input.description);

  const created = await prisma.quoteLocalPacket.create({
    data: {
      tenantId: draft.tenantId,
      quoteVersionId: draft.quoteVersionId,
      displayName,
      description: description ?? undefined,
      originType: "MANUAL_LOCAL",
      promotionStatus: "NONE",
      createdById: input.userId,
    },
    select: { id: true },
  });

  await bumpComposePreviewStalenessToken(prisma, draft.quoteVersionId);

  const detail = await getQuoteLocalPacketForTenant(prisma, {
    tenantId: draft.tenantId,
    quoteLocalPacketId: created.id,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_NOT_FOUND",
      "Created QuoteLocalPacket could not be re-read in tenant scope.",
      { quoteLocalPacketId: created.id },
    );
  }
  return detail;
}

export type UpdateQuoteLocalPacketInput = {
  tenantId: string;
  quoteLocalPacketId: string;
  userId: string;
  displayName?: unknown;
  description?: unknown;
};

export async function updateQuoteLocalPacketForTenant(
  prisma: PrismaClient,
  input: UpdateQuoteLocalPacketInput,
): Promise<QuoteLocalPacketDto | "not_found"> {
  const loaded = await loadDraftPacketForActor(prisma, {
    tenantId: input.tenantId,
    quoteLocalPacketId: input.quoteLocalPacketId,
    userId: input.userId,
  });
  if (!loaded.ok) return "not_found";

  const data: { displayName?: string; description?: string | null; updatedById: string } = {
    updatedById: input.userId,
  };
  if (input.displayName !== undefined) {
    data.displayName = assertDisplayName(input.displayName);
  }
  if (input.description !== undefined) {
    data.description = assertOptionalDescription(input.description);
  }

  await prisma.quoteLocalPacket.update({
    where: { id: loaded.packetId },
    data,
  });

  await bumpComposePreviewStalenessToken(prisma, loaded.quoteVersionId);

  const detail = await getQuoteLocalPacketForTenant(prisma, {
    tenantId: loaded.tenantId,
    quoteLocalPacketId: loaded.packetId,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_NOT_FOUND",
      "QuoteLocalPacket vanished mid-update (unexpected).",
      { quoteLocalPacketId: loaded.packetId },
    );
  }
  return detail;
}

export async function deleteQuoteLocalPacketForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteLocalPacketId: string; userId: string },
): Promise<"deleted" | "not_found"> {
  const loaded = await loadDraftPacketForActor(prisma, {
    tenantId: params.tenantId,
    quoteLocalPacketId: params.quoteLocalPacketId,
    userId: params.userId,
  });
  if (!loaded.ok) return "not_found";

  const pinningCount = await prisma.quoteLineItem.count({
    where: {
      quoteLocalPacketId: loaded.packetId,
      quoteVersionId: loaded.quoteVersionId,
    },
  });
  if (pinningCount > 0) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_HAS_PINNING_LINES",
      "QuoteLocalPacket cannot be deleted while one or more QuoteLineItems pin it. Detach those line items first.",
      { quoteLocalPacketId: loaded.packetId, pinningLineItemCount: pinningCount },
    );
  }

  await prisma.quoteLocalPacket.delete({ where: { id: loaded.packetId } });
  await bumpComposePreviewStalenessToken(prisma, loaded.quoteVersionId);
  return "deleted";
}

/* ─────────────────────────── Item CRUD ─────────────────────────── */

async function loadTaskDefinitionForTenant(
  prisma: PrismaClient,
  tenantId: string,
  taskDefinitionId: string,
): Promise<{ id: string } | null> {
  return prisma.taskDefinition.findFirst({
    where: { id: taskDefinitionId, tenantId },
    select: { id: true },
  });
}

export type CreateQuoteLocalPacketItemInput = {
  tenantId: string;
  quoteLocalPacketId: string;
  userId: string;
  lineKey: unknown;
  sortOrder: unknown;
  tierCode?: unknown;
  lineKind: unknown;
  embeddedPayloadJson?: unknown;
  taskDefinitionId?: unknown;
  targetNodeKey: unknown;
};

export async function createQuoteLocalPacketItemForTenant(
  prisma: PrismaClient,
  input: CreateQuoteLocalPacketItemInput,
): Promise<QuoteLocalPacketDto | "not_found"> {
  const loaded = await loadDraftPacketForActor(prisma, {
    tenantId: input.tenantId,
    quoteLocalPacketId: input.quoteLocalPacketId,
    userId: input.userId,
  });
  if (!loaded.ok) return "not_found";

  const lineKey = assertLineKey(input.lineKey);
  const sortOrder = assertSortOrder(input.sortOrder);
  const tierCode = assertOptionalTierCode(input.tierCode);
  const lineKind = assertLineKind(input.lineKind);
  const targetNodeKey = assertTargetNodeKey(input.targetNodeKey);
  const embeddedPayloadJson = assertOptionalEmbeddedPayload(input.embeddedPayloadJson);
  const taskDefinitionId = assertOptionalTaskDefinitionId(input.taskDefinitionId);

  if (taskDefinitionId) {
    const td = await loadTaskDefinitionForTenant(prisma, loaded.tenantId, taskDefinitionId);
    if (!td) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND",
        "taskDefinitionId does not reference a TaskDefinition in this tenant.",
        { taskDefinitionId },
      );
    }
  }

  assertQuoteLocalPacketItemLineKindPayload({
    lineKind,
    embeddedPayloadJson,
    taskDefinitionId,
  });

  const existingKey = await prisma.quoteLocalPacketItem.findUnique({
    where: { quoteLocalPacketId_lineKey: { quoteLocalPacketId: loaded.packetId, lineKey } },
    select: { id: true },
  });
  if (existingKey) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_LINE_KEY_TAKEN",
      "lineKey is already used by another item on this packet.",
      { quoteLocalPacketId: loaded.packetId, lineKey },
    );
  }

  await prisma.quoteLocalPacketItem.create({
    data: {
      quoteLocalPacketId: loaded.packetId,
      lineKey,
      sortOrder,
      tierCode,
      lineKind,
      embeddedPayloadJson:
        embeddedPayloadJson === null
          ? Prisma.JsonNull
          : (embeddedPayloadJson as Prisma.InputJsonValue),
      taskDefinitionId,
      targetNodeKey,
    },
    select: { id: true },
  });

  await prisma.quoteLocalPacket.update({
    where: { id: loaded.packetId },
    data: { updatedById: input.userId },
  });
  await bumpComposePreviewStalenessToken(prisma, loaded.quoteVersionId);

  const detail = await getQuoteLocalPacketForTenant(prisma, {
    tenantId: loaded.tenantId,
    quoteLocalPacketId: loaded.packetId,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_NOT_FOUND",
      "QuoteLocalPacket vanished after item create (unexpected).",
      { quoteLocalPacketId: loaded.packetId },
    );
  }
  return detail;
}

export type UpdateQuoteLocalPacketItemInput = {
  tenantId: string;
  quoteLocalPacketId: string;
  itemId: string;
  userId: string;
  lineKey?: unknown;
  sortOrder?: unknown;
  tierCode?: unknown;
  lineKind?: unknown;
  embeddedPayloadJson?: unknown;
  taskDefinitionId?: unknown;
  targetNodeKey?: unknown;
};

export async function updateQuoteLocalPacketItemForTenant(
  prisma: PrismaClient,
  input: UpdateQuoteLocalPacketItemInput,
): Promise<QuoteLocalPacketDto | "not_found"> {
  const loaded = await loadDraftPacketForActor(prisma, {
    tenantId: input.tenantId,
    quoteLocalPacketId: input.quoteLocalPacketId,
    userId: input.userId,
  });
  if (!loaded.ok) return "not_found";

  const existing = await prisma.quoteLocalPacketItem.findFirst({
    where: { id: input.itemId, quoteLocalPacketId: loaded.packetId },
    select: {
      id: true,
      lineKey: true,
      sortOrder: true,
      tierCode: true,
      lineKind: true,
      embeddedPayloadJson: true,
      taskDefinitionId: true,
      targetNodeKey: true,
    },
  });
  if (!existing) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_NOT_FOUND",
      "QuoteLocalPacketItem not found on this packet.",
      { quoteLocalPacketId: loaded.packetId, itemId: input.itemId },
    );
  }

  const merged = {
    lineKey: input.lineKey !== undefined ? assertLineKey(input.lineKey) : existing.lineKey,
    sortOrder: input.sortOrder !== undefined ? assertSortOrder(input.sortOrder) : existing.sortOrder,
    tierCode:
      input.tierCode !== undefined ? assertOptionalTierCode(input.tierCode) : existing.tierCode,
    lineKind: input.lineKind !== undefined ? assertLineKind(input.lineKind) : existing.lineKind,
    embeddedPayloadJson:
      input.embeddedPayloadJson !== undefined
        ? assertOptionalEmbeddedPayload(input.embeddedPayloadJson)
        : (existing.embeddedPayloadJson as Record<string, unknown> | null),
    taskDefinitionId:
      input.taskDefinitionId !== undefined
        ? assertOptionalTaskDefinitionId(input.taskDefinitionId)
        : existing.taskDefinitionId,
    targetNodeKey:
      input.targetNodeKey !== undefined
        ? assertTargetNodeKey(input.targetNodeKey)
        : existing.targetNodeKey,
  };

  if (merged.taskDefinitionId && merged.taskDefinitionId !== existing.taskDefinitionId) {
    const td = await loadTaskDefinitionForTenant(prisma, loaded.tenantId, merged.taskDefinitionId);
    if (!td) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND",
        "taskDefinitionId does not reference a TaskDefinition in this tenant.",
        { taskDefinitionId: merged.taskDefinitionId },
      );
    }
  }

  assertQuoteLocalPacketItemLineKindPayload({
    lineKind: merged.lineKind,
    embeddedPayloadJson: merged.embeddedPayloadJson,
    taskDefinitionId: merged.taskDefinitionId,
    quoteLocalPacketItemId: existing.id,
  });

  if (merged.lineKey !== existing.lineKey) {
    const collide = await prisma.quoteLocalPacketItem.findUnique({
      where: { quoteLocalPacketId_lineKey: { quoteLocalPacketId: loaded.packetId, lineKey: merged.lineKey } },
      select: { id: true },
    });
    if (collide && collide.id !== existing.id) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_ITEM_LINE_KEY_TAKEN",
        "lineKey is already used by another item on this packet.",
        { quoteLocalPacketId: loaded.packetId, lineKey: merged.lineKey },
      );
    }
  }

  await prisma.quoteLocalPacketItem.update({
    where: { id: existing.id },
    data: {
      lineKey: merged.lineKey,
      sortOrder: merged.sortOrder,
      tierCode: merged.tierCode,
      lineKind: merged.lineKind,
      embeddedPayloadJson:
        merged.embeddedPayloadJson === null
          ? Prisma.JsonNull
          : (merged.embeddedPayloadJson as Prisma.InputJsonValue),
      taskDefinitionId: merged.taskDefinitionId,
      targetNodeKey: merged.targetNodeKey,
    },
  });

  await prisma.quoteLocalPacket.update({
    where: { id: loaded.packetId },
    data: { updatedById: input.userId },
  });
  await bumpComposePreviewStalenessToken(prisma, loaded.quoteVersionId);

  const detail = await getQuoteLocalPacketForTenant(prisma, {
    tenantId: loaded.tenantId,
    quoteLocalPacketId: loaded.packetId,
  });
  if (!detail) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_NOT_FOUND",
      "QuoteLocalPacket vanished after item update (unexpected).",
      { quoteLocalPacketId: loaded.packetId },
    );
  }
  return detail;
}

export async function deleteQuoteLocalPacketItemForTenant(
  prisma: PrismaClient,
  params: { tenantId: string; quoteLocalPacketId: string; itemId: string; userId: string },
): Promise<"deleted" | "not_found"> {
  const loaded = await loadDraftPacketForActor(prisma, {
    tenantId: params.tenantId,
    quoteLocalPacketId: params.quoteLocalPacketId,
    userId: params.userId,
  });
  if (!loaded.ok) return "not_found";

  const existing = await prisma.quoteLocalPacketItem.findFirst({
    where: { id: params.itemId, quoteLocalPacketId: loaded.packetId },
    select: { id: true },
  });
  if (!existing) {
    throw new InvariantViolationError(
      "QUOTE_LOCAL_PACKET_ITEM_NOT_FOUND",
      "QuoteLocalPacketItem not found on this packet.",
      { quoteLocalPacketId: loaded.packetId, itemId: params.itemId },
    );
  }

  await prisma.quoteLocalPacketItem.delete({ where: { id: existing.id } });
  await prisma.quoteLocalPacket.update({
    where: { id: loaded.packetId },
    data: { updatedById: params.userId },
  });
  await bumpComposePreviewStalenessToken(prisma, loaded.quoteVersionId);

  return "deleted";
}
