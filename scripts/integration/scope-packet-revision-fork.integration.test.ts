/**
 * Quote-local fork from a PUBLISHED `ScopePacketRevision` (DRAFT → editable
 * `QuoteLocalPacket` with originType = FORK_FROM_LIBRARY).
 *
 * End-to-end loop closure: promote a quote-local packet → publish the
 * resulting revision → fork that PUBLISHED revision into a new quote-local
 * packet on a different DRAFT quote version → mutate one item on the local
 * fork → assert the source PUBLISHED revision remains byte-identical. Plus
 * the canon-locked source/target preflight rejections.
 *
 * Prereqs (same as auth-spine.integration.test.ts):
 *   1. Postgres + DATABASE_URL
 *   2. `npx prisma migrate deploy`
 *   3. `npm run db:seed` → writes scripts/integration/fixture.json
 *   4. `AUTH_SECRET` in .env.local
 *   5. `npm run dev` on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Scope (locked to canon — do not widen):
 *   - happy path: publish → fork → edit local → source revision unchanged.
 *   - source-not-PUBLISHED: forking a DRAFT revision returns 409
 *     SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED.
 *   - target-not-DRAFT is NOT covered as a separate case here because the
 *     existing assertQuoteVersionDraft is exercised by every other quote-local
 *     mutation already; we trust it.
 *   - tenant isolation: cross-tenant fork returns 404.
 *
 * Out of scope (intentional, deferred): catalog-side editing, revision-2
 * creation, supersede, archive, auto-pin to a QuoteLineItem, rich quote
 * picker UX. See docs/canon/05-packet-canon.md §100-101 and
 * docs/bridge-decisions/03-packet-fork-promotion-decision.md.
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
      customerName: `Fork Customer ${suffix}`,
      flowGroupName: `Fork FlowGroup ${suffix}`,
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

async function fork(
  baseUrl: string,
  cookie: string,
  targetQuoteVersionId: string,
  scopePacketRevisionId: string,
  displayName?: string,
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/quote-versions/${encodeURIComponent(targetQuoteVersionId)}/local-packets/fork-from-revision`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ scopePacketRevisionId, displayName }),
    },
  );
}

async function readSourceRevision(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
  scopePacketRevisionId: string,
): Promise<{
  status: string;
  publishedAtIso: string | null;
  packetTaskLines: {
    lineKey: string;
    sortOrder: number;
    tierCode: string | null;
    lineKind: string;
    targetNodeKey: string;
    taskDefinitionId: string | null;
    hasEmbeddedPayload: boolean;
    embeddedPayloadJson: unknown;
  }[];
}> {
  const res = await fetch(
    `${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(
      scopePacketRevisionId,
    )}`,
    { headers: { Cookie: cookie } },
  );
  expect(res.status).toBe(200);
  const j = (await res.json()) as {
    data?: {
      revision: { status: string; publishedAtIso: string | null };
      packetTaskLines: {
        lineKey: string;
        sortOrder: number;
        tierCode: string | null;
        lineKind: string;
        targetNodeKey: string;
        taskDefinitionId: string | null;
        hasEmbeddedPayload: boolean;
        embeddedPayloadJson: unknown;
      }[];
    };
  };
  return {
    status: j.data!.revision.status,
    publishedAtIso: j.data!.revision.publishedAtIso,
    packetTaskLines: j.data!.packetTaskLines,
  };
}

describe("quote-local fork from PUBLISHED ScopePacketRevision (HTTP API)", () => {
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

  it("happy path: publish → fork → edit local → source PUBLISHED revision is unchanged", async () => {
    const suffix = `${Date.now()}-fork-happy`;

    // Source quote → local packet → promote → publish.
    const src = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-src`);
    const sourceLocal = await createLocalPacket(
      baseUrl,
      cookieOffice,
      src.quoteVersionId,
      "Source for fork",
    );
    await addEmbeddedItem(baseUrl, cookieOffice, sourceLocal.id, {
      lineKey: "task-a",
      sortOrder: 0,
      targetNodeKey: "node-a",
      embeddedPayloadJson: { title: "A original", taskKind: "LABOR" },
      tierCode: "GOOD",
    });
    await addEmbeddedItem(baseUrl, cookieOffice, sourceLocal.id, {
      lineKey: "task-b",
      sortOrder: 10,
      targetNodeKey: "node-b",
      embeddedPayloadJson: { title: "B original", taskKind: "LABOR", deep: { nested: [1, 2] } },
    });

    const packetKey = `fork-happy-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      sourceLocal.id,
      packetKey,
    );

    const pubRes = await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(pubRes.status).toBe(200);

    // Snapshot source state immediately after publish.
    const before = await readSourceRevision(
      baseUrl,
      cookieOffice,
      scopePacketId,
      scopePacketRevisionId,
    );
    expect(before.status).toBe("PUBLISHED");
    expect(typeof before.publishedAtIso).toBe("string");
    expect(before.packetTaskLines).toHaveLength(2);

    // Different DRAFT quote version → fork onto it.
    const dst = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-dst`);
    const forkRes = await fork(
      baseUrl,
      cookieOffice,
      dst.quoteVersionId,
      scopePacketRevisionId,
      "Forked copy for editing",
    );
    expect(forkRes.status).toBe(201);
    const forkJ = (await forkRes.json()) as {
      data?: {
        id: string;
        tenantId: string;
        quoteVersionId: string;
        displayName: string;
        originType: string;
        forkedFromScopePacketRevisionId: string | null;
        promotionStatus: string;
        promotedScopePacketId: string | null;
        items: {
          id: string;
          lineKey: string;
          sortOrder: number;
          tierCode: string | null;
          lineKind: string;
          targetNodeKey: string;
          taskDefinitionId: string | null;
          embeddedPayloadJson: unknown;
        }[];
      };
    };
    const forked = forkJ.data!;
    expect(forked.quoteVersionId).toBe(dst.quoteVersionId);
    expect(forked.originType).toBe("FORK_FROM_LIBRARY");
    expect(forked.forkedFromScopePacketRevisionId).toBe(scopePacketRevisionId);
    expect(forked.promotionStatus).toBe("NONE");
    expect(forked.promotedScopePacketId).toBeNull();
    expect(forked.displayName).toBe("Forked copy for editing");
    expect(forked.items).toHaveLength(2);

    // Field-for-field faithful copy (sorted by sortOrder asc).
    const taskA = forked.items.find((i) => i.lineKey === "task-a");
    const taskB = forked.items.find((i) => i.lineKey === "task-b");
    expect(taskA).toBeDefined();
    expect(taskB).toBeDefined();
    expect(taskA!.sortOrder).toBe(0);
    expect(taskA!.tierCode).toBe("GOOD");
    expect(taskA!.lineKind).toBe("EMBEDDED");
    expect(taskA!.targetNodeKey).toBe("node-a");
    expect(taskA!.embeddedPayloadJson).toEqual({ title: "A original", taskKind: "LABOR" });
    expect(taskB!.sortOrder).toBe(10);
    expect(taskB!.embeddedPayloadJson).toEqual({
      title: "B original",
      taskKind: "LABOR",
      deep: { nested: [1, 2] },
    });

    // Mutate the local fork — change task-a's payload via PATCH on the item.
    const patchRes = await fetch(
      `${baseUrl}/api/quote-local-packets/${encodeURIComponent(forked.id)}/items/${encodeURIComponent(taskA!.id)}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({
          embeddedPayloadJson: { title: "A LOCAL EDIT", taskKind: "LABOR" },
        }),
      },
    );
    expect(patchRes.status).toBe(200);

    // Re-read source PUBLISHED revision — must be byte-identical to `before`.
    const after = await readSourceRevision(
      baseUrl,
      cookieOffice,
      scopePacketId,
      scopePacketRevisionId,
    );
    expect(after.status).toBe(before.status);
    expect(after.publishedAtIso).toBe(before.publishedAtIso);
    expect(after.packetTaskLines).toEqual(before.packetTaskLines);
    // And specifically the EMBEDDED payload on the source did NOT pick up the local edit.
    const sourceA = after.packetTaskLines.find((l) => l.lineKey === "task-a");
    expect(sourceA?.embeddedPayloadJson).toEqual({ title: "A original", taskKind: "LABOR" });
  });

  it("source-not-PUBLISHED: forking a DRAFT revision returns 409 SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED", async () => {
    const suffix = `${Date.now()}-fork-draft`;
    const src = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-src`);
    const sourceLocal = await createLocalPacket(
      baseUrl,
      cookieOffice,
      src.quoteVersionId,
      "Draft source",
    );
    await addEmbeddedItem(baseUrl, cookieOffice, sourceLocal.id, {
      lineKey: "task-1",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `fork-draft-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      sourceLocal.id,
      packetKey,
    );
    // Do NOT publish — revision stays DRAFT.

    const dst = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-dst`);
    const res = await fork(baseUrl, cookieOffice, dst.quoteVersionId, scopePacketRevisionId);
    expect(res.status).toBe(409);
    const j = (await res.json()) as ApiError & {
      error?: { context?: { currentStatus?: string } };
    };
    expect(j.error?.code).toBe("SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED");
    expect(j.error?.context?.currentStatus).toBe("DRAFT");
  });

  it("tenant isolation: tenant B cannot fork a tenant A revision (404)", async () => {
    const suffix = `${Date.now()}-fork-iso`;
    const src = await createQuoteShell(baseUrl, cookieOffice, `${suffix}-src`);
    const sourceLocal = await createLocalPacket(
      baseUrl,
      cookieOffice,
      src.quoteVersionId,
      "Iso source",
    );
    await addEmbeddedItem(baseUrl, cookieOffice, sourceLocal.id, {
      lineKey: "x",
      sortOrder: 0,
      targetNodeKey: "node-x",
    });
    const packetKey = `fork-iso-${suffix}`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const { scopePacketId, scopePacketRevisionId } = await promote(
      baseUrl,
      cookieOffice,
      sourceLocal.id,
      packetKey,
    );
    expect(
      (await publish(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId)).status,
    ).toBe(200);

    // Tenant B creates its own destination quote version, then attempts to fork
    // a tenant A revision into it. The source-revision tenant filter rejects
    // first with 404.
    const dstB = await createQuoteShell(baseUrl, cookieTenantB, `${suffix}-dstB`);
    const cross = await fork(baseUrl, cookieTenantB, dstB.quoteVersionId, scopePacketRevisionId);
    expect(cross.status).toBe(404);
    const j = (await cross.json()) as ApiError;
    expect(j.error?.code).toBe("NOT_FOUND");
  });
});
