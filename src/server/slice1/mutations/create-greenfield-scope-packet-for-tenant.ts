import { Prisma, type PrismaClient } from "@prisma/client";
import { assertDisplayName, assertPacketKey } from "@/lib/quote-local-packet-input";
import { InvariantViolationError } from "../errors";

const MIN_PACKET_KEY = 2;
const MAX_PACKET_KEY = 80;
const PACKET_KEY_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/**
 * Slug-like key from display name (same rules as `assertPacketKey` / promotion).
 */
export function slugPacketKeyFromDisplayName(displayName: string): string {
  let s = displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (s.length < MIN_PACKET_KEY) s = "scope-packet";
  if (s.length > MAX_PACKET_KEY) {
    s = s.slice(0, MAX_PACKET_KEY).replace(/-+$/g, "");
  }
  while (s.endsWith("-")) s = s.slice(0, -1);
  while (s.startsWith("-")) s = s.slice(1);
  if (s.length < MIN_PACKET_KEY) s = "scope-packet";
  if (!PACKET_KEY_PATTERN.test(s)) s = "scope-packet";
  return s.slice(0, MAX_PACKET_KEY);
}

async function allocateDerivedPacketKey(
  prisma: PrismaClient,
  tenantId: string,
  displayName: string,
): Promise<string> {
  const base = slugPacketKeyFromDisplayName(displayName);
  for (let i = 0; i < 200; i++) {
    const suffix = i === 0 ? "" : `-${i + 1}`;
    let candidate = (base + suffix).slice(0, MAX_PACKET_KEY).replace(/-+$/g, "");
    while (candidate.endsWith("-")) candidate = candidate.slice(0, -1);
    while (candidate.startsWith("-")) candidate = candidate.slice(1);
    if (candidate.length < MIN_PACKET_KEY) continue;
    if (!PACKET_KEY_PATTERN.test(candidate)) continue;
    const exists = await prisma.scopePacket.findFirst({
      where: { tenantId, packetKey: candidate },
      select: { id: true },
    });
    if (!exists) return candidate;
  }
  throw new InvariantViolationError(
    "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN",
    "Could not allocate a unique packetKey from displayName; specify packetKey explicitly.",
    { tenantId },
  );
}

export type CreateGreenfieldScopePacketInput = {
  tenantId: string;
  /** Reserved for future audit / actor columns. */
  userId: string;
  displayName: unknown;
  /** Optional; when omitted, a unique slug is derived from `displayName`. */
  packetKey?: unknown;
};

export type CreateGreenfieldScopePacketResult = {
  scopePacket: { id: string; packetKey: string; displayName: string };
  scopePacketRevision: {
    id: string;
    revisionNumber: number;
    status: "DRAFT";
    publishedAtIso: null;
  };
};

/**
 * Greenfield library packet: new `ScopePacket` + first `ScopePacketRevision` (r1, DRAFT, no lines).
 *
 * Does not replace promotion; complements it for catalog growth without a quote-local source.
 *
 * Canon: `ScopePacket` / `ScopePacketRevision` invariants — at most one DRAFT per packet is satisfied
 * because this is the only revision created here.
 */
export async function createGreenfieldScopePacketForTenant(
  prisma: PrismaClient,
  input: CreateGreenfieldScopePacketInput,
): Promise<CreateGreenfieldScopePacketResult> {
  const displayName = assertDisplayName(input.displayName);

  let packetKey: string;
  const rawKey = input.packetKey;
  if (rawKey !== undefined && rawKey !== null && typeof rawKey === "string" && rawKey.trim() !== "") {
    packetKey = assertPacketKey(rawKey);
    const collide = await prisma.scopePacket.findFirst({
      where: { tenantId: input.tenantId, packetKey },
      select: { id: true },
    });
    if (collide) {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN",
        "Another ScopePacket on this tenant already uses this packetKey; choose a different key.",
        { packetKey, existingScopePacketId: collide.id },
      );
    }
  } else {
    packetKey = await allocateDerivedPacketKey(prisma, input.tenantId, displayName);
  }

  try {
    const row = await prisma.$transaction(async (tx) => {
      const newPacket = await tx.scopePacket.create({
        data: {
          tenantId: input.tenantId,
          packetKey,
          displayName,
        },
        select: { id: true, packetKey: true, displayName: true },
      });

      const newRevision = await tx.scopePacketRevision.create({
        data: {
          scopePacketId: newPacket.id,
          revisionNumber: 1,
          status: "DRAFT",
          publishedAt: null,
        },
        select: { id: true, revisionNumber: true, status: true, publishedAt: true },
      });

      return { newPacket, newRevision };
    });

    return {
      scopePacket: row.newPacket,
      scopePacketRevision: {
        id: row.newRevision.id,
        revisionNumber: row.newRevision.revisionNumber,
        status: "DRAFT",
        publishedAtIso: null,
      },
    };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      throw new InvariantViolationError(
        "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN",
        "Another ScopePacket on this tenant already uses this packetKey (concurrent create); choose a different key.",
        { packetKey },
      );
    }
    throw e;
  }
}
