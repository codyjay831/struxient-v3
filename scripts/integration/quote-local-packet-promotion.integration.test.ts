/**
 * Interim one-step `QuoteLocalPacket` → catalog `ScopePacket` promotion
 * smoke tests against a running Next.js server.
 *
 * Prereqs (same as auth-spine.integration.test.ts):
 *   1. Postgres + DATABASE_URL
 *   2. `npx prisma migrate deploy` (or dev) — must include
 *      `20260420120000_packet_promotion_authorize`
 *   3. `npm run db:seed` → writes scripts/integration/fixture.json
 *   4. `AUTH_SECRET` in .env.local
 *   5. `npm run dev` on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Scope (locked to canon — do not widen):
 *   - happy path: estimator promotes a DRAFT QuoteLocalPacket; server creates
 *     a new ScopePacket + first DRAFT revision (publishedAt = null) and copies
 *     items 1:1; source becomes COMPLETED; catalog inspector reads succeed
 *     against the new DRAFT revision.
 *   - re-promotion refusal (409 ALREADY_PROMOTED).
 *   - packetKey collision refusal (409 PACKET_KEY_TAKEN).
 *   - tenant isolation (cross-tenant promotion → 404).
 *
 * Out of scope (intentional, deferred): admin-review queue, ScopePacket.status,
 * publish flow, packetKey rename. See:
 *   - docs/canon/05-packet-canon.md
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md
 */
import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import {
  integrationBaseUrl,
  loadSmokeFixture,
  signInCredentialsSession,
  type SmokeFixture,
} from "./auth-spine-helpers";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

type ApiError = { error?: { code?: string; message?: string } };

async function createQuoteShell(
  baseUrl: string,
  cookie: string,
  suffix: string,
): Promise<{ quoteVersionId: string }> {
  const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: `Promotion Customer ${suffix}`,
      flowGroupName: `Promotion FlowGroup ${suffix}`,
    }),
  });
  expect(res.status).toBe(200);
  const j = (await res.json()) as { data?: { quoteVersion?: { id: string } } };
  const qvId = j.data?.quoteVersion?.id;
  expect(qvId).toBeDefined();
  return { quoteVersionId: qvId! };
}

async function createLocalPacket(
  baseUrl: string,
  cookie: string,
  quoteVersionId: string,
  displayName: string,
): Promise<{ id: string }> {
  const res = await fetch(
    `${baseUrl}/api/quote-versions/${encodeURIComponent(quoteVersionId)}/local-packets`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    },
  );
  expect(res.status).toBe(201);
  const j = (await res.json()) as { data?: { id: string } };
  expect(j.data?.id).toBeDefined();
  return { id: j.data!.id };
}

async function addEmbeddedItem(
  baseUrl: string,
  cookie: string,
  quoteLocalPacketId: string,
  body: {
    lineKey: string;
    sortOrder: number;
    targetNodeKey: string;
    tierCode?: string | null;
    embeddedPayloadJson?: Record<string, unknown> | null;
  },
): Promise<void> {
  const res = await fetch(
    `${baseUrl}/api/quote-local-packets/${encodeURIComponent(quoteLocalPacketId)}/items`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        lineKind: "EMBEDDED",
        lineKey: body.lineKey,
        sortOrder: body.sortOrder,
        targetNodeKey: body.targetNodeKey,
        tierCode: body.tierCode ?? null,
        embeddedPayloadJson:
          body.embeddedPayloadJson ?? { title: `Task ${body.lineKey}`, taskKind: "LABOR" },
        taskDefinitionId: null,
      }),
    },
  );
  expect(res.status).toBe(201);
}

async function promote(
  baseUrl: string,
  cookie: string,
  quoteLocalPacketId: string,
  body: { packetKey: unknown; displayName?: unknown },
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/quote-local-packets/${encodeURIComponent(quoteLocalPacketId)}/promote`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

describe("interim one-step QuoteLocalPacket promotion (HTTP API)", () => {
  let baseUrl: string;
  let fx: SmokeFixture;
  let cookieOffice: string;
  let cookieTenantB: string;

  beforeAll(async () => {
    baseUrl = integrationBaseUrl();
    const ping = await fetch(`${baseUrl}/api/auth/providers`).catch(() => null);
    if (!ping?.ok) {
      throw new Error(
        `Integration server not reachable at ${baseUrl}. Start Next (npm run dev), set INTEGRATION_BASE_URL if needed.`,
      );
    }
    fx = loadSmokeFixture();
    cookieOffice = await signInCredentialsSession(
      baseUrl,
      fx.tenantAId,
      fx.emails.office,
      fx.basePassword,
    );
    cookieTenantB = await signInCredentialsSession(
      baseUrl,
      fx.tenantBId,
      fx.emails.tenantBOffice,
      fx.basePassword,
    );
  });

  it("happy path: promotes a DRAFT packet, creates DRAFT revision (publishedAt=null), copies items 1:1, marks source COMPLETED", async () => {
    const suffix = `${Date.now()}-happy`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Roof tear-off (local)");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "tear-off-1",
      sortOrder: 0,
      targetNodeKey: "node-roof",
      tierCode: "GOOD",
    });
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "haul-off-1",
      sortOrder: 1,
      targetNodeKey: "node-haul",
    });

    const packetKey = `promo-happy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const promoteRes = await promote(baseUrl, cookieOffice, packet.id, { packetKey });
    expect(promoteRes.status).toBe(201);
    const pj = (await promoteRes.json()) as {
      data?: {
        promotion?: {
          quoteLocalPacketId: string;
          promotionStatus: "COMPLETED";
          promotedScopePacketId: string;
          scopePacket: { id: string; packetKey: string; displayName: string };
          scopePacketRevision: {
            id: string;
            revisionNumber: number;
            status: "DRAFT";
            publishedAtIso: string | null;
            packetTaskLineCount: number;
          };
        };
        quoteLocalPacket?: {
          promotionStatus: string;
          promotedScopePacketId: string | null;
        };
      };
    };
    const promotion = pj.data?.promotion;
    expect(promotion).toBeDefined();
    expect(promotion!.promotionStatus).toBe("COMPLETED");
    expect(promotion!.scopePacketRevision.revisionNumber).toBe(1);
    expect(promotion!.scopePacketRevision.status).toBe("DRAFT");
    expect(promotion!.scopePacketRevision.publishedAtIso).toBeNull();
    expect(promotion!.scopePacketRevision.packetTaskLineCount).toBe(2);
    expect(promotion!.scopePacket.packetKey).toBe(packetKey);
    expect(pj.data?.quoteLocalPacket?.promotionStatus).toBe("COMPLETED");
    expect(pj.data?.quoteLocalPacket?.promotedScopePacketId).toBe(promotion!.promotedScopePacketId);

    // Catalog inspector survives a DRAFT-only revision (publishedAt = null).
    const detailRes = await fetch(
      `${baseUrl}/api/scope-packets/${encodeURIComponent(promotion!.promotedScopePacketId)}`,
      { headers: { Cookie: cookieOffice } },
    );
    expect(detailRes.status).toBe(200);
    const dj = (await detailRes.json()) as {
      data?: {
        id: string;
        packetKey: string;
        revisions: { id: string; status: string; publishedAtIso: string | null }[];
      };
    };
    expect(dj.data?.packetKey).toBe(packetKey);
    expect(dj.data?.revisions?.length).toBe(1);
    expect(dj.data?.revisions?.[0]?.status).toBe("DRAFT");
    expect(dj.data?.revisions?.[0]?.publishedAtIso).toBeNull();

    // Revision detail surfaces every line, copied 1:1, with top-level targetNodeKey.
    const revRes = await fetch(
      `${baseUrl}/api/scope-packets/${encodeURIComponent(
        promotion!.promotedScopePacketId,
      )}/revisions/${encodeURIComponent(promotion!.scopePacketRevision.id)}`,
      { headers: { Cookie: cookieOffice } },
    );
    expect(revRes.status).toBe(200);
    const rj = (await revRes.json()) as {
      data?: {
        revision: { status: string; publishedAtIso: string | null };
        packetTaskLines: {
          lineKey: string;
          sortOrder: number;
          tierCode: string | null;
          lineKind: string;
          targetNodeKey: string;
        }[];
      };
    };
    expect(rj.data?.revision.status).toBe("DRAFT");
    expect(rj.data?.revision.publishedAtIso).toBeNull();
    const lines = rj.data?.packetTaskLines ?? [];
    expect(lines.length).toBe(2);
    const byKey = Object.fromEntries(lines.map((l) => [l.lineKey, l]));
    expect(byKey["tear-off-1"]?.targetNodeKey).toBe("node-roof");
    expect(byKey["tear-off-1"]?.tierCode).toBe("GOOD");
    expect(byKey["tear-off-1"]?.lineKind).toBe("EMBEDDED");
    expect(byKey["haul-off-1"]?.targetNodeKey).toBe("node-haul");
    expect(byKey["haul-off-1"]?.tierCode).toBeNull();

    // Publish-readiness predicate: a clean-source promotion must come back as
    // ready with zero blockers.
    const rr = (
      await (
        await fetch(
          `${baseUrl}/api/scope-packets/${encodeURIComponent(
            promotion!.promotedScopePacketId,
          )}/revisions/${encodeURIComponent(promotion!.scopePacketRevision.id)}`,
          { headers: { Cookie: cookieOffice } },
        )
      ).json()
    ) as {
      data?: {
        publishReadiness?: {
          isReady: boolean;
          blockers: { code: string; lineKey?: string }[];
        };
      };
    };
    expect(rr.data?.publishReadiness?.isReady).toBe(true);
    expect(rr.data?.publishReadiness?.blockers).toEqual([]);
  });

  it("publish-readiness flags EMBEDDED_ROW_PAYLOAD_EMPTY on a promoted DRAFT with `{}` payload", async () => {
    const suffix = `${Date.now()}-rdy-bad`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Empty payload");
    // EMBEDDED row with empty-object payload — accepted by source invariant
    // (only `null` is rejected) but must be flagged as a publish blocker.
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "empty-payload",
      sortOrder: 0,
      targetNodeKey: "node-x",
      embeddedPayloadJson: {},
    });

    const packetKey = `promo-rdy-bad-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const promoteRes = await promote(baseUrl, cookieOffice, packet.id, { packetKey });
    expect(promoteRes.status).toBe(201);
    const pj = (await promoteRes.json()) as {
      data?: { promotion?: { promotedScopePacketId: string; scopePacketRevision: { id: string } } };
    };
    const promotion = pj.data?.promotion;
    expect(promotion).toBeDefined();

    const revRes = await fetch(
      `${baseUrl}/api/scope-packets/${encodeURIComponent(
        promotion!.promotedScopePacketId,
      )}/revisions/${encodeURIComponent(promotion!.scopePacketRevision.id)}`,
      { headers: { Cookie: cookieOffice } },
    );
    expect(revRes.status).toBe(200);
    const rj = (await revRes.json()) as {
      data?: {
        publishReadiness?: {
          isReady: boolean;
          blockers: { code: string; lineKey?: string }[];
        };
      };
    };
    expect(rj.data?.publishReadiness?.isReady).toBe(false);
    const codes = (rj.data?.publishReadiness?.blockers ?? []).map((b) => b.code);
    expect(codes).toContain("EMBEDDED_ROW_PAYLOAD_EMPTY");
    const blocker = (rj.data?.publishReadiness?.blockers ?? []).find(
      (b) => b.code === "EMBEDDED_ROW_PAYLOAD_EMPTY",
    );
    expect(blocker?.lineKey).toBe("empty-payload");
  });

  it("re-promotion is refused with ALREADY_PROMOTED (409)", async () => {
    const suffix = `${Date.now()}-rep`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Re-promote");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });

    const packetKey = `promo-rep-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const first = await promote(baseUrl, cookieOffice, packet.id, { packetKey });
    expect(first.status).toBe(201);

    const second = await promote(baseUrl, cookieOffice, packet.id, { packetKey: `${packetKey}-2` });
    expect(second.status).toBe(409);
    const j = (await second.json()) as ApiError;
    expect(j.error?.code).toBe("QUOTE_LOCAL_PACKET_PROMOTION_ALREADY_PROMOTED");
  });

  it("packetKey collision is refused with PACKET_KEY_TAKEN (409)", async () => {
    const suffix = `${Date.now()}-coll`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);

    const packetA = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "A");
    await addEmbeddedItem(baseUrl, cookieOffice, packetA.id, {
      lineKey: "a",
      sortOrder: 0,
      targetNodeKey: "node-a",
    });
    const packetB = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "B");
    await addEmbeddedItem(baseUrl, cookieOffice, packetB.id, {
      lineKey: "b",
      sortOrder: 0,
      targetNodeKey: "node-b",
    });

    const packetKey = `promo-coll-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const first = await promote(baseUrl, cookieOffice, packetA.id, { packetKey });
    expect(first.status).toBe(201);

    const second = await promote(baseUrl, cookieOffice, packetB.id, { packetKey });
    expect(second.status).toBe(409);
    const j = (await second.json()) as ApiError;
    expect(j.error?.code).toBe("QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN");
  });

  it("invalid packetKey is refused with INVALID_PACKET_KEY (400)", async () => {
    const suffix = `${Date.now()}-bad`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Bad key");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });

    const res = await promote(baseUrl, cookieOffice, packet.id, { packetKey: "Not A Slug!" });
    expect(res.status).toBe(400);
    const j = (await res.json()) as ApiError;
    expect(j.error?.code).toBe("QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY");
  });

  it("tenant isolation: tenant B cannot promote a tenant A packet (404)", async () => {
    const suffix = `${Date.now()}-iso`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Iso");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });

    const packetKey = `promo-iso-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const cross = await promote(baseUrl, cookieTenantB, packet.id, { packetKey });
    expect(cross.status).toBe(404);
    const j = (await cross.json()) as ApiError;
    expect(j.error?.code).toBe("NOT_FOUND");
  });

  it("source packet without items is refused with SOURCE_HAS_NO_ITEMS (400)", async () => {
    const suffix = `${Date.now()}-empty`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Empty");

    const packetKey = `promo-empty-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const res = await promote(baseUrl, cookieOffice, packet.id, { packetKey });
    expect(res.status).toBe(400);
    const j = (await res.json()) as ApiError;
    expect(j.error?.code).toBe("QUOTE_LOCAL_PACKET_PROMOTION_SOURCE_HAS_NO_ITEMS");
  });
});
