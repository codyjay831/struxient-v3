/**
 * Revision-2 evolution: create the next DRAFT `ScopePacketRevision` as a deep
 * clone of the current PUBLISHED revision; publish-of-N+1 demotes the prior
 * PUBLISHED to SUPERSEDED in the same transaction; existing quote-line pins
 * to the now-SUPERSEDED revision still load on the read side; new pins to the
 * SUPERSEDED revision are still rejected on the write side.
 *
 * End-to-end loop:
 *   promote → publish r1 → pin (succeeds) → create r2 DRAFT → publish r2
 *   → assert r1 is SUPERSEDED, r2 is PUBLISHED
 *   → assert the quote-version scope view still loads (existing pin to r1 OK)
 *   → assert a NEW pin attempt to r1 is rejected (mutation-side strict mode)
 *
 * Plus the canon-locked rejections:
 *   - source-not-PUBLISHED: create-DRAFT on a packet with only DRAFT returns 409
 *     `SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE`.
 *   - existing-DRAFT: a second create-DRAFT call returns 409
 *     `SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT`.
 *   - tenant isolation: tenant B cannot create-DRAFT on a tenant A packet (404).
 *
 * Prereqs (same as auth-spine.integration.test.ts):
 *   1. Postgres + DATABASE_URL
 *   2. `npx prisma migrate deploy` (must include
 *      `20260421120000_add_superseded_to_scope_packet_revision_status`)
 *   3. `npm run db:seed` → writes scripts/integration/fixture.json
 *   4. `AUTH_SECRET` in .env.local
 *   5. `npm run dev` on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Out of scope (intentional, deferred): catalog-side editing of DRAFT, fork
 * from SUPERSEDED, supersede-on-DRAFT-publish from a different tenant, admin-
 * review queue, audit columns. See:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — revision-2 evolution
 *     policy (post-publish)")
 *   - docs/implementation/decision-packs/revision-2-evolution-decision-pack.md
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

type ApiError = { error?: { code?: string; message?: string; context?: unknown } };

async function createQuoteShell(
  baseUrl: string,
  cookie: string,
  suffix: string,
): Promise<{ quoteVersionId: string; proposalGroupId: string }> {
  const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: `Rev2 Customer ${suffix}`,
      flowGroupName: `Rev2 FlowGroup ${suffix}`,
    }),
  });
  expect(res.status).toBe(200);
  const j = (await res.json()) as {
    data?: { quoteVersion?: { id: string }; proposalGroup?: { id: string } };
  };
  return { quoteVersionId: j.data!.quoteVersion!.id, proposalGroupId: j.data!.proposalGroup!.id };
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
    embeddedPayloadJson?: Record<string, unknown>;
    tierCode?: string | null;
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
  packetKey: string,
): Promise<{ scopePacketId: string; scopePacketRevisionId: string }> {
  const res = await fetch(
    `${baseUrl}/api/quote-local-packets/${encodeURIComponent(quoteLocalPacketId)}/promote`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ packetKey }),
    },
  );
  expect(res.status).toBe(201);
  const j = (await res.json()) as {
    data?: {
      promotion?: {
        promotedScopePacketId: string;
        scopePacketRevision: { id: string; status: string };
      };
    };
  };
  return {
    scopePacketId: j.data!.promotion!.promotedScopePacketId,
    scopePacketRevisionId: j.data!.promotion!.scopePacketRevision.id,
  };
}

async function publish(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
  scopePacketRevisionId: string,
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(
      scopePacketRevisionId,
    )}/publish`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

async function createNextDraft(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );
}

async function pinManifestLineItem(
  baseUrl: string,
  cookie: string,
  quoteVersionId: string,
  body: {
    proposalGroupId: string;
    sortOrder: number;
    title: string;
    scopePacketRevisionId: string;
  },
): Promise<Response> {
  return fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      proposalGroupId: body.proposalGroupId,
      sortOrder: body.sortOrder,
      executionMode: "MANIFEST",
      title: body.title,
      quantity: 1,
      scopePacketRevisionId: body.scopePacketRevisionId,
      quoteLocalPacketId: null,
    }),
  });
}

async function readPacketDetail(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
): Promise<{
  revisions: { id: string; revisionNumber: number; status: string }[];
  hasDraftRevision: boolean;
  publishedRevisionCount: number;
  supersededRevisionCount: number;
}> {
  const res = await fetch(`${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}`, {
    headers: { Cookie: cookie },
  });
  expect(res.status).toBe(200);
  const j = (await res.json()) as {
    data?: {
      revisions: { id: string; revisionNumber: number; status: string }[];
      hasDraftRevision: boolean;
      publishedRevisionCount: number;
      supersededRevisionCount: number;
    };
  };
  return {
    revisions: j.data!.revisions,
    hasDraftRevision: j.data!.hasDraftRevision,
    publishedRevisionCount: j.data!.publishedRevisionCount,
    supersededRevisionCount: j.data!.supersededRevisionCount,
  };
}

async function readQuoteScopeView(
  baseUrl: string,
  cookie: string,
  quoteVersionId: string,
): Promise<Response> {
  // The quote-version scope read fires `assertQuoteVersionScopeViewInvariants`;
  // a 200 response is the proof that the broadened read-side pin invariant
  // accepted the SUPERSEDED row.
  return fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(quoteVersionId)}/scope`, {
    headers: { Cookie: cookie },
  });
}

describe("revision-2 evolution: create-DRAFT, publish-with-supersede, read-pin-broadening (HTTP API)", () => {
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

  it("happy path: promote → publish r1 → pin r1 → create r2 DRAFT → publish r2 demotes r1 to SUPERSEDED → existing pin still reads → new pin to r1 rejects", async () => {
    const suffix = `${Date.now()}-rev2-happy`;

    // Set up a quote, a local packet with two embedded items, promote it.
    const src = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const local = await createLocalPacket(baseUrl, cookieOffice, src.quoteVersionId, "Rev2 Source");
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "task-a",
      sortOrder: 0,
      targetNodeKey: "node-a",
      embeddedPayloadJson: { title: "A r1", taskKind: "LABOR", deep: { tags: ["x"] } },
      tierCode: "GOOD",
    });
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "task-b",
      sortOrder: 10,
      targetNodeKey: "node-b",
      embeddedPayloadJson: { title: "B r1", taskKind: "LABOR" },
    });

    const packetKey = `rev2-happy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId: r1Id } = await promote(
      baseUrl,
      cookieOffice,
      local.id,
      packetKey,
    );

    // Publish r1.
    const pub1 = await publish(baseUrl, cookieOffice, scopePacketId, r1Id);
    expect(pub1.status).toBe(200);
    const pub1J = (await pub1.json()) as {
      data?: { publish?: { status: string; demotedSiblingCount: number } };
    };
    expect(pub1J.data?.publish?.status).toBe("PUBLISHED");
    // First publish on the packet — nothing to demote.
    expect(pub1J.data?.publish?.demotedSiblingCount).toBe(0);

    // Pin r1 onto a manifest line item — must succeed (canon picker contract).
    const pin1 = await pinManifestLineItem(baseUrl, cookieOffice, src.quoteVersionId, {
      proposalGroupId: src.proposalGroupId,
      sortOrder: 0,
      title: "Pin to r1 (must succeed)",
      scopePacketRevisionId: r1Id,
    });
    expect(pin1.status).toBe(201);

    // Create r2 DRAFT as a deep clone of r1.
    const draftRes = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    expect(draftRes.status).toBe(201);
    const draftJ = (await draftRes.json()) as {
      data?: {
        createDraftFromPublished?: {
          newRevision?: { id: string; revisionNumber: number; status: string; packetTaskLineCount: number };
          sourcePublishedRevision?: { id: string; revisionNumber: number };
        };
      };
    };
    const r2Id = draftJ.data?.createDraftFromPublished?.newRevision?.id;
    expect(r2Id).toBeDefined();
    expect(draftJ.data?.createDraftFromPublished?.newRevision?.status).toBe("DRAFT");
    expect(draftJ.data?.createDraftFromPublished?.newRevision?.revisionNumber).toBe(2);
    expect(draftJ.data?.createDraftFromPublished?.newRevision?.packetTaskLineCount).toBe(2);
    expect(draftJ.data?.createDraftFromPublished?.sourcePublishedRevision?.id).toBe(r1Id);

    // Multi-DRAFT rejection: a second create-DRAFT call must fail.
    const draftRes2 = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    expect(draftRes2.status).toBe(409);
    const draftJ2 = (await draftRes2.json()) as ApiError;
    expect(draftJ2.error?.code).toBe("SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT");

    // Publish r2 — must succeed AND demote r1 to SUPERSEDED in the same transaction.
    const pub2 = await publish(baseUrl, cookieOffice, scopePacketId, r2Id!);
    expect(pub2.status).toBe(200);
    const pub2J = (await pub2.json()) as {
      data?: { publish?: { status: string; demotedSiblingCount: number; revisionNumber: number } };
    };
    expect(pub2J.data?.publish?.status).toBe("PUBLISHED");
    expect(pub2J.data?.publish?.revisionNumber).toBe(2);
    expect(pub2J.data?.publish?.demotedSiblingCount).toBe(1);

    // Read packet detail back; r1 is SUPERSEDED, r2 is PUBLISHED.
    const detail = await readPacketDetail(baseUrl, cookieOffice, scopePacketId);
    const r1After = detail.revisions.find((r) => r.id === r1Id)!;
    const r2After = detail.revisions.find((r) => r.id === r2Id)!;
    expect(r1After.status).toBe("SUPERSEDED");
    expect(r2After.status).toBe("PUBLISHED");
    expect(detail.publishedRevisionCount).toBe(1);
    expect(detail.supersededRevisionCount).toBe(1);
    expect(detail.hasDraftRevision).toBe(false);

    // Read-side: the quote-version scope view must still load (the existing
    // pin to r1 — now SUPERSEDED — must resolve via the broadened read-side
    // assertion).
    const scopeRes = await readQuoteScopeView(baseUrl, cookieOffice, src.quoteVersionId);
    expect(scopeRes.status).toBe(200);
    const scopeJ = (await scopeRes.json()) as {
      data?: {
        orderedLineItems: {
          id: string;
          scopePacketRevisionId: string | null;
          scopeRevision: { id: string; status: string } | null;
        }[];
      };
    };
    const stillPinned = scopeJ.data?.orderedLineItems.find(
      (l) => l.scopePacketRevisionId === r1Id,
    );
    expect(stillPinned).toBeDefined();
    expect(stillPinned?.scopeRevision?.status).toBe("SUPERSEDED");

    // Mutation-side: a NEW pin attempt to r1 must still reject with the
    // canon error code (write-side strict mode unchanged).
    const newPinRes = await pinManifestLineItem(baseUrl, cookieOffice, src.quoteVersionId, {
      proposalGroupId: src.proposalGroupId,
      sortOrder: 100,
      title: "Pin to r1 after demotion (must fail)",
      scopePacketRevisionId: r1Id,
    });
    expect(newPinRes.status).toBe(409);
    const newPinJ = (await newPinRes.json()) as ApiError & {
      error?: { context?: { scopePacketRevisionId?: string; currentStatus?: string } };
    };
    expect(newPinJ.error?.code).toBe("LINE_SCOPE_REVISION_NOT_PUBLISHED");
    expect(newPinJ.error?.context?.scopePacketRevisionId).toBe(r1Id);
    expect(newPinJ.error?.context?.currentStatus).toBe("SUPERSEDED");

    // After publishing r2, the packet again has 0 DRAFT revisions and the UI
    // gate should re-open: a third create-DRAFT call must now succeed.
    const draftRes3 = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    expect(draftRes3.status).toBe(201);
    const draftJ3 = (await draftRes3.json()) as {
      data?: { createDraftFromPublished?: { newRevision?: { revisionNumber: number; packetTaskLineCount: number } } };
    };
    expect(draftJ3.data?.createDraftFromPublished?.newRevision?.revisionNumber).toBe(3);
    // The clone source for r3 is r2 (the latest PUBLISHED) — also 2 lines.
    expect(draftJ3.data?.createDraftFromPublished?.newRevision?.packetTaskLineCount).toBe(2);
  });

  it("rejects create-DRAFT when the packet has no PUBLISHED revision (only DRAFT exists)", async () => {
    const suffix = `${Date.now()}-rev2-no-pub`;
    const src = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const local = await createLocalPacket(baseUrl, cookieOffice, src.quoteVersionId, "Rev2 NoPub");
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `rev2-no-pub-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId } = await promote(baseUrl, cookieOffice, local.id, packetKey);
    // Promotion produced a single DRAFT revision (revision 1); it has not been
    // published, so create-DRAFT must reject with NO_PUBLISHED_SOURCE.
    const res = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    expect(res.status).toBe(409);
    const j = (await res.json()) as ApiError;
    expect(j.error?.code).toBe("SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE");
  });

  it("tenant isolation: tenant B cannot create a DRAFT on a tenant A packet (404)", async () => {
    const suffix = `${Date.now()}-rev2-iso`;
    const src = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const local = await createLocalPacket(baseUrl, cookieOffice, src.quoteVersionId, "Rev2 Iso");
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `rev2-iso-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      local.id,
      packetKey,
    );
    // Publish r1 so the packet has a PUBLISHED revision (otherwise the 409
    // NO_PUBLISHED_SOURCE check would fire before the tenant isolation gate
    // and we wouldn't be exercising the gate we want to assert).
    const pub = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(pub.status).toBe(200);

    const cross = await createNextDraft(baseUrl, cookieTenantB, scopePacketId);
    expect(cross.status).toBe(404);
    const j = (await cross.json()) as ApiError;
    expect(j.error?.code).toBe("NOT_FOUND");
  });

  it("publishing a SUPERSEDED revision is rejected with 409 NOT_DRAFT (canon picker contract preserved)", async () => {
    const suffix = `${Date.now()}-rev2-sup-republish`;
    const src = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const local = await createLocalPacket(
      baseUrl,
      cookieOffice,
      src.quoteVersionId,
      "Rev2 SupRepublish",
    );
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `rev2-sup-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId: r1Id } = await promote(
      baseUrl,
      cookieOffice,
      local.id,
      packetKey,
    );
    expect((await publish(baseUrl, cookieOffice, scopePacketId, r1Id)).status).toBe(200);

    // Create + publish r2 to demote r1.
    const draftRes = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    expect(draftRes.status).toBe(201);
    const draftJ = (await draftRes.json()) as {
      data?: { createDraftFromPublished?: { newRevision?: { id: string } } };
    };
    const r2Id = draftJ.data!.createDraftFromPublished!.newRevision!.id;
    expect((await publish(baseUrl, cookieOffice, scopePacketId, r2Id)).status).toBe(200);

    // Re-publishing r1 (now SUPERSEDED) must reject with NOT_DRAFT.
    const repubRes = await publish(baseUrl, cookieOffice, scopePacketId, r1Id);
    expect(repubRes.status).toBe(409);
    const repubJ = (await repubRes.json()) as ApiError & {
      error?: { context?: { currentStatus?: string } };
    };
    expect(repubJ.error?.code).toBe("SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT");
    expect(repubJ.error?.context?.currentStatus).toBe("SUPERSEDED");
  });

  it("forking a SUPERSEDED revision is rejected with 409 SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED (decision pack §10)", async () => {
    const suffix = `${Date.now()}-rev2-fork-sup`;
    const src = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const local = await createLocalPacket(baseUrl, cookieOffice, src.quoteVersionId, "Rev2 ForkSup");
    await addEmbeddedItem(baseUrl, cookieOffice, local.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `rev2-forksup-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId: r1Id } = await promote(
      baseUrl,
      cookieOffice,
      local.id,
      packetKey,
    );
    expect((await publish(baseUrl, cookieOffice, scopePacketId, r1Id)).status).toBe(200);
    const draftRes = await createNextDraft(baseUrl, cookieOffice, scopePacketId);
    const draftJ = (await draftRes.json()) as {
      data?: { createDraftFromPublished?: { newRevision?: { id: string } } };
    };
    const r2Id = draftJ.data!.createDraftFromPublished!.newRevision!.id;
    expect((await publish(baseUrl, cookieOffice, scopePacketId, r2Id)).status).toBe(200);

    // Fork r1 (SUPERSEDED) onto a new DRAFT quote-version: must reject.
    const dst = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-dst`);
    const forkRes = await fetch(
      `${baseUrl}/api/quote-versions/${encodeURIComponent(dst.quoteVersionId)}/local-packets/fork-from-revision`,
      {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({ scopePacketRevisionId: r1Id }),
      },
    );
    expect(forkRes.status).toBe(409);
    const forkJ = (await forkRes.json()) as ApiError;
    expect(forkJ.error?.code).toBe("SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED");
  });
});
