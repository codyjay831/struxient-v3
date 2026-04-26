/**
 * Interim publish action for `ScopePacketRevision` (DRAFT → PUBLISHED).
 *
 * End-to-end loop closure: promote a quote-local packet → assert resulting
 * DRAFT revision rejects line-item pinning → publish → assert the SAME
 * revision now accepts line-item pinning. Plus the canon-locked preflight
 * rejections from the interim-publish-authority decision pack.
 *
 * Prereqs (same as auth-spine.integration.test.ts):
 *   1. Postgres + DATABASE_URL
 *   2. `npx prisma migrate deploy`
 *   3. `npm run db:seed` → writes scripts/integration/fixture.json
 *   4. `AUTH_SECRET` in .env.local
 *   5. `npm run dev` on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Scope (locked to canon — do not widen):
 *   - happy path: promote → publish → verify PUBLISHED + publishedAt set;
 *     follow-up line-item pin under `LINE_SCOPE_REVISION_NOT_PUBLISHED` guard
 *     succeeds (the loop is closed).
 *   - re-publish refusal: PUBLISHED revision returns 409 NOT_DRAFT.
 *   - readiness gate: revision with `EMBEDDED_ROW_PAYLOAD_EMPTY` blocker
 *     returns 409 NOT_READY with blockers in context.
 *   - tenant isolation: cross-tenant publish returns 404.
 *
 * Out of scope (intentional, deferred): admin-review queue, catalog editor,
 * un-publish, supersede, archive, multi-PUBLISHED supersede semantics. See:
 *   - docs/canon/05-packet-canon.md ("Canon amendment — interim publish authority")
 *   - docs/implementation/decision-packs/interim-publish-authority-decision-pack.md
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
      customerName: `Publish Customer ${suffix}`,
      flowGroupName: `Publish FlowGroup ${suffix}`,
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
        tierCode: null,
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
  expect(j.data?.promotion?.scopePacketRevision.status).toBe("DRAFT");
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

describe("interim publish action for ScopePacketRevision (HTTP API)", () => {
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

  it("happy path: promote → publish → revision becomes pinnable on a quote line item (loop closed)", async () => {
    const suffix = `${Date.now()}-pub-happy`;
    const { quoteVersionId, proposalGroupId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Source for publish");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "task-1",
      sortOrder: 0,
      targetNodeKey: "install",
    });

    const packetKey = `pub-happy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      packet.id,
      packetKey,
    );

    // Pre-condition: pinning the DRAFT revision must be rejected by the
    // already-shipped LINE_SCOPE_REVISION_NOT_PUBLISHED guard.
    const preRes = await pinManifestLineItem(baseUrl, cookieOffice, quoteVersionId, {
      proposalGroupId,
      sortOrder: 0,
      title: "Pre-publish pin (must fail)",
      scopePacketRevisionId,
    });
    expect(preRes.status).toBe(409);
    const preJ = (await preRes.json()) as ApiError;
    expect(preJ.error?.code).toBe("LINE_SCOPE_REVISION_NOT_PUBLISHED");

    // Publish.
    const publishRes = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(publishRes.status).toBe(200);
    const publishJ = (await publishRes.json()) as {
      data?: {
        publish?: {
          scopePacketId: string;
          scopePacketRevisionId: string;
          status: string;
          publishedAtIso: string;
          revisionNumber: number;
        };
        scopePacketRevisionDetail?: {
          revision: { status: string; publishedAtIso: string | null };
          publishReadiness: { isReady: boolean };
        };
      };
    };
    expect(publishJ.data?.publish?.status).toBe("PUBLISHED");
    expect(publishJ.data?.publish?.scopePacketId).toBe(scopePacketId);
    expect(publishJ.data?.publish?.scopePacketRevisionId).toBe(scopePacketRevisionId);
    expect(publishJ.data?.publish?.revisionNumber).toBe(1);
    expect(typeof publishJ.data?.publish?.publishedAtIso).toBe("string");
    // refreshed detail must reflect the new state in the same response
    expect(publishJ.data?.scopePacketRevisionDetail?.revision.status).toBe("PUBLISHED");
    expect(publishJ.data?.scopePacketRevisionDetail?.revision.publishedAtIso).toBe(
      publishJ.data?.publish?.publishedAtIso,
    );
    // Post-publish, readiness still evaluates to true (predicate runs regardless of status).
    expect(publishJ.data?.scopePacketRevisionDetail?.publishReadiness.isReady).toBe(true);

    // Post-condition: pinning the SAME revision now succeeds — the loop is closed.
    const postRes = await pinManifestLineItem(baseUrl, cookieOffice, quoteVersionId, {
      proposalGroupId,
      sortOrder: 100,
      title: "Post-publish pin (must succeed)",
      scopePacketRevisionId,
    });
    expect(postRes.status).toBe(201);
    const postJ = (await postRes.json()) as {
      data?: { id: string; scopePacketRevisionId: string | null; executionMode: string };
    };
    expect(postJ.data?.scopePacketRevisionId).toBe(scopePacketRevisionId);
    expect(postJ.data?.executionMode).toBe("MANIFEST");
  });

  it("re-publish of an already-PUBLISHED revision is refused with 409 NOT_DRAFT (not no-op)", async () => {
    const suffix = `${Date.now()}-pub-rep`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Re-publish source");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "install",
    });
    const packetKey = `pub-rep-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      packet.id,
      packetKey,
    );

    const first = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(first.status).toBe(200);

    const second = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(second.status).toBe(409);
    const j = (await second.json()) as ApiError & {
      error?: { context?: { currentStatus?: string; scopePacketRevisionId?: string } };
    };
    expect(j.error?.code).toBe("SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT");
    expect(j.error?.context?.currentStatus).toBe("PUBLISHED");
    expect(j.error?.context?.scopePacketRevisionId).toBe(scopePacketRevisionId);
  });

  it("readiness gate: DRAFT revision with EMBEDDED_ROW_PAYLOAD_EMPTY blocker is refused with 409 NOT_READY", async () => {
    const suffix = `${Date.now()}-pub-rdy`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Empty payload");
    // EMBEDDED row with `{}` payload — accepted by source invariant but flagged
    // as a publish blocker by the readiness predicate.
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "empty-payload",
      sortOrder: 0,
      targetNodeKey: "install",
      embeddedPayloadJson: {},
    });

    const packetKey = `pub-rdy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      packet.id,
      packetKey,
    );

    const res = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(res.status).toBe(409);
    const j = (await res.json()) as ApiError & {
      error?: { context?: { blockers?: { code: string; lineKey?: string }[] } };
    };
    expect(j.error?.code).toBe("SCOPE_PACKET_REVISION_PUBLISH_NOT_READY");
    const codes = (j.error?.context?.blockers ?? []).map((b) => b.code);
    expect(codes).toContain("EMBEDDED_ROW_PAYLOAD_EMPTY");
  });

  it("tenant isolation: tenant B cannot publish a tenant A revision (404)", async () => {
    const suffix = `${Date.now()}-pub-iso`;
    const { quoteVersionId } = await createQuoteShell(baseUrl, cookieOffice, suffix);
    const packet = await createLocalPacket(baseUrl, cookieOffice, quoteVersionId, "Iso");
    await addEmbeddedItem(baseUrl, cookieOffice, packet.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "install",
    });
    const packetKey = `pub-iso-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      packet.id,
      packetKey,
    );

    const cross = await publish(baseUrl, cookieTenantB, scopePacketId, scopePacketRevisionId);
    expect(cross.status).toBe(404);
    const j = (await cross.json()) as ApiError;
    expect(j.error?.code).toBe("NOT_FOUND");
  });
});
