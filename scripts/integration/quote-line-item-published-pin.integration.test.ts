/**
 * Quote line-item server-boundary enforcement of the canon picker contract:
 * `QuoteLineItem.scopePacketRevisionId` may only point at a PUBLISHED
 * `ScopePacketRevision`.
 *
 * Closes the gap exposed by the interim one-step promotion flow, which can
 * now produce real DRAFT revisions in the catalog.
 *
 * Prereqs (same as auth-spine.integration.test.ts):
 *   1. Postgres + DATABASE_URL
 *   2. `npx prisma migrate deploy` (must include
 *      `20260420120000_packet_promotion_authorize`)
 *   3. `npm run db:seed` → writes scripts/integration/fixture.json (must
 *      include `seedPublishedScopePacketRevisionId`)
 *   4. `AUTH_SECRET` in .env.local
 *   5. `npm run dev` on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Scope (locked to canon — do not widen):
 *   - DRAFT rejection: promote a fresh quote-local packet → attempt to pin
 *     the resulting DRAFT revision onto a quote line item → expect 409
 *     `LINE_SCOPE_REVISION_NOT_PUBLISHED`.
 *   - PUBLISHED control: pin the seeded PUBLISHED revision → expect 201.
 *
 * Out of scope (intentional, deferred): publish flow, packet picker UI,
 * catalog editor, ScopePacket.status. See:
 *   - docs/canon/05-packet-canon.md ("PUBLISHED revision discipline for pickers")
 *   - docs/implementation/decision-packs/interim-packet-promotion-decision-pack.md §7
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
): Promise<{ quoteVersionId: string; proposalGroupId: string }> {
  const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({
      customerName: `Pin-Pub Customer ${suffix}`,
      flowGroupName: `Pin-Pub FlowGroup ${suffix}`,
    }),
  });
  expect(res.status).toBe(200);
  const j = (await res.json()) as {
    data?: {
      quoteVersion?: { id: string };
      proposalGroup?: { id: string };
    };
  };
  const qvId = j.data?.quoteVersion?.id;
  const pgId = j.data?.proposalGroup?.id;
  expect(qvId).toBeDefined();
  expect(pgId).toBeDefined();
  return { quoteVersionId: qvId!, proposalGroupId: pgId! };
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
  body: { lineKey: string; sortOrder: number; targetNodeKey: string },
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
        tierCode: null,
        embeddedPayloadJson: { title: `Task ${body.lineKey}`, taskKind: "LABOR" },
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
  body: { packetKey: string },
): Promise<{ scopePacketRevisionId: string }> {
  const res = await fetch(
    `${baseUrl}/api/quote-local-packets/${encodeURIComponent(quoteLocalPacketId)}/promote`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  expect(res.status).toBe(201);
  const j = (await res.json()) as {
    data?: { promotion?: { scopePacketRevision?: { id: string; status: string } } };
  };
  const rev = j.data?.promotion?.scopePacketRevision;
  expect(rev?.status).toBe("DRAFT");
  expect(rev?.id).toBeDefined();
  return { scopePacketRevisionId: rev!.id };
}

async function createManifestLineItem(
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
  return fetch(
    `${baseUrl}/api/quote-versions/${encodeURIComponent(quoteVersionId)}/line-items`,
    {
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
    },
  );
}

describe("QuoteLineItem PUBLISHED-only scope-revision pin enforcement (HTTP API)", () => {
  let baseUrl: string;
  let fx: SmokeFixture;
  let cookieOffice: string;

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
  });

  it("rejects pinning a freshly promoted DRAFT scope revision with 409 LINE_SCOPE_REVISION_NOT_PUBLISHED", async () => {
    const suffix = `${Date.now()}-draft`;
    const { quoteVersionId, proposalGroupId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Source for DRAFT pin");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "install",
    });

    const packetKey = `pin-pub-draft-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketRevisionId } = await promote(baseUrl, cookieOffice, packet.id, { packetKey });

    const res = await createManifestLineItem(baseUrl, cookieOffice, quoteVersionId, {
      proposalGroupId,
      sortOrder: 100,
      title: "Manifest line trying to pin DRAFT",
      scopePacketRevisionId,
    });
    expect(res.status).toBe(409);
    const j = (await res.json()) as ApiError & {
      error?: { context?: { scopePacketRevisionId?: string; currentStatus?: string } };
    };
    expect(j.error?.code).toBe("LINE_SCOPE_REVISION_NOT_PUBLISHED");
    expect(j.error?.context?.scopePacketRevisionId).toBe(scopePacketRevisionId);
    expect(j.error?.context?.currentStatus).toBe("DRAFT");
  });

  it("accepts pinning the seeded PUBLISHED scope revision (control)", async () => {
    if (!fx.seedPublishedScopePacketRevisionId) {
      throw new Error(
        "fixture.json missing seedPublishedScopePacketRevisionId; re-run `npm run db:seed`.",
      );
    }
    const suffix = `${Date.now()}-pub`;
    const { quoteVersionId, proposalGroupId } = await createQuoteShell(baseUrl, cookieOffice, suffix);

    const res = await createManifestLineItem(baseUrl, cookieOffice, quoteVersionId, {
      proposalGroupId,
      sortOrder: 0,
      title: "Manifest line pinning a PUBLISHED revision",
      scopePacketRevisionId: fx.seedPublishedScopePacketRevisionId,
    });
    expect(res.status).toBe(201);
    const j = (await res.json()) as {
      data?: { id: string; scopePacketRevisionId: string | null; executionMode: string };
    };
    expect(j.data?.scopePacketRevisionId).toBe(fx.seedPublishedScopePacketRevisionId);
    expect(j.data?.executionMode).toBe("MANIFEST");
  });
});
