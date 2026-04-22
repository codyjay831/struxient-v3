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

/**
 * Add one **EMBEDDED** `PacketTaskLine` to a **DRAFT** library revision (Epic 16).
 * LIBRARY lines and non-DRAFT revisions remain out of scope.
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
