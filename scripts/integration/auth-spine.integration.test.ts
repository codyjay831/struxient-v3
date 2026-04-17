/**
 * Auth + tenant boundary smoke tests against a running Next.js server.
 *
 * Prereqs:
 * 1. Postgres + DATABASE_URL
 * 2. `npx prisma migrate deploy` (or dev)
 * 3. `npm run db:seed` → writes scripts/integration/fixture.json (includes `seedPublishedWorkflowVersionId` /
 *    `seedPublishedScopePacketRevisionId` for the full-chain lifecycle smoke)
 * 4. `AUTH_SECRET` in .env.local (or env)
 * 5. `npm run dev` (or start) on INTEGRATION_BASE_URL (default http://127.0.0.1:3000)
 *
 * Optional for field-execution success: `npm run db:seed:activated` and STRUXIENT_DEV_FLOW_ID in .env.local
 * (tests load .env.local via dotenv below).
 */
import { config as loadEnv } from "dotenv";
import { beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  integrationBaseUrl,
  loadSmokeFixture,
  signInCredentialsSession,
  type SmokeFixture,
} from "./auth-spine-helpers";

loadEnv({ path: ".env" });
loadEnv({ path: ".env.local" });

describe("auth spine integration (real session + HTTP API)", () => {
  let baseUrl: string;
  let fx: SmokeFixture;
  let cookieOffice: string;
  let cookieReadOnly: string;
  let cookieField: string;
  let cookieTenantB: string;
  /** Resolved when DB has activation + STRUXIENT_DEV_FLOW_ID */
  let runtimeTaskId: string | null = null;
  let activatedFlowId: string | null = null;

  beforeAll(async () => {
    baseUrl = integrationBaseUrl();

    const ping = await fetch(`${baseUrl}/api/auth/providers`).catch(() => null);
    if (!ping?.ok) {
      throw new Error(
        `Integration server not reachable at ${baseUrl}. Start Next (npm run dev), set INTEGRATION_BASE_URL if needed.`,
      );
    }

    fx = loadSmokeFixture();

    const flowEnv = process.env.STRUXIENT_DEV_FLOW_ID?.trim();
    const dbUrl = process.env.DATABASE_URL?.trim();
    if (flowEnv && dbUrl) {
      const prisma = new PrismaClient();
      try {
        const rt = await prisma.runtimeTask.findFirst({
          where: { flowId: flowEnv, tenantId: fx.tenantAId },
          select: { id: true },
        });
        runtimeTaskId = rt?.id ?? null;
        activatedFlowId = flowEnv;
      } finally {
        await prisma.$disconnect();
      }
    }

    cookieOffice = await signInCredentialsSession(baseUrl, fx.tenantAId, fx.emails.office, fx.basePassword);
    cookieReadOnly = await signInCredentialsSession(baseUrl, fx.tenantAId, fx.emails.readOnly, fx.basePassword);
    cookieField = await signInCredentialsSession(baseUrl, fx.tenantAId, fx.emails.field, fx.basePassword);
    cookieTenantB = await signInCredentialsSession(baseUrl, fx.tenantBId, fx.emails.tenantBOffice, fx.basePassword);
  });

  it("rejects unauthenticated GET scope (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/scope`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET quotes list (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quotes`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET quote version history (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/clocynvalidquoteid00000/versions`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET quote workspace (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/clocynvalidquoteid00000/workspace`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET customers list (401)", async () => {
    const res = await fetch(`${baseUrl}/api/customers`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET flow-groups list (401)", async () => {
    const res = await fetch(`${baseUrl}/api/flow-groups`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("rejects unauthenticated GET workflow-versions (401)", async () => {
    const res = await fetch(`${baseUrl}/api/workflow-versions`);
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("office GET workflow-versions returns PUBLISHED filter and items (200)", async () => {
    const res = await fetch(`${baseUrl}/api/workflow-versions?limit=20`, { headers: { Cookie: cookieOffice } });
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      data?: { items?: { id: string; status: string }[]; filter?: string; limit?: number };
    };
    expect(j.data?.filter).toBe("PUBLISHED");
    expect(Array.isArray(j.data?.items)).toBe(true);
    expect(j.data?.items?.length).toBeGreaterThanOrEqual(1);
    expect(j.data?.items?.every((x) => x.status === "PUBLISHED")).toBe(true);
  });

  it("READ_ONLY can GET workflow-versions (200)", async () => {
    const res = await fetch(`${baseUrl}/api/workflow-versions`, { headers: { Cookie: cookieReadOnly } });
    expect(res.status).toBe(200);
  });

  it("tenant B cannot GET tenant A workflow version by id (404)", async () => {
    const listRes = await fetch(`${baseUrl}/api/workflow-versions?limit=5`, { headers: { Cookie: cookieOffice } });
    expect(listRes.status).toBe(200);
    const wid = ((await listRes.json()) as { data?: { items?: { id: string }[] } }).data?.items?.[0]?.id;
    expect(wid).toBeDefined();
    const res = await fetch(`${baseUrl}/api/workflow-versions/${encodeURIComponent(wid!)}`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(res.status).toBe(404);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("NOT_FOUND");
  });

  it("office GET workflow-version by id returns discovery shell (200)", async () => {
    const listRes = await fetch(`${baseUrl}/api/workflow-versions?limit=1`, { headers: { Cookie: cookieOffice } });
    expect(listRes.status).toBe(200);
    const wid = ((await listRes.json()) as { data?: { items?: { id: string }[] } }).data?.items?.[0]?.id;
    expect(wid).toBeDefined();
    const res = await fetch(`${baseUrl}/api/workflow-versions/${encodeURIComponent(wid!)}`, {
      headers: { Cookie: cookieOffice },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data?: { id?: string; status?: string } };
    expect(j.data?.id).toBe(wid);
    expect(j.data?.status).toBe("PUBLISHED");
  });

  it("rejects unauthenticated POST send (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientStalenessToken: null, sendClientRequestId: "smoke-unauth" }),
    });
    expect(res.status).toBe(401);
  });

  it("office role: GET scope succeeds (200) for same tenant", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/scope`, {
      headers: { Cookie: cookieOffice },
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as { data?: { quoteVersionId?: string }; meta?: { auth?: { source?: string } } };
    expect(j.data?.quoteVersionId).toBe(fx.quoteVersionId);
    expect(j.meta?.auth?.source).toBe("session");
  });

  it("office role: PATCH proposal group succeeds (office_mutate)", async () => {
    const res = await fetch(
      `${baseUrl}/api/quote-versions/${fx.quoteVersionId}/proposal-groups/${fx.proposalGroupId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Main-smoke-${Date.now()}` }),
      },
    );
    expect(res.status).toBe(200);
  });

  it("office role: POST commercial quote-shell creates tenant-bound shell (200) and scope reads", async () => {
    const suffix = Date.now();
    const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `Smoke Customer ${suffix}`,
        flowGroupName: `Smoke FlowGroup ${suffix}`,
      }),
    });
    expect(res.status).toBe(200);
    const j = (await res.json()) as {
      data?: {
        quoteVersion?: { id: string; status?: string; versionNumber?: number };
        proposalGroup?: { name?: string; sortOrder?: number };
        quote?: { quoteNumber?: string };
      };
      meta?: { auth?: { source?: string } };
    };
    expect(j.meta?.auth?.source).toBe("session");
    expect(j.data?.quoteVersion?.id).toBeDefined();
    expect(j.data?.quoteVersion?.status).toBe("DRAFT");
    expect(j.data?.quoteVersion?.versionNumber).toBe(1);
    expect(j.data?.proposalGroup?.name).toBe("Main");
    expect(j.data?.proposalGroup?.sortOrder).toBe(0);
    expect(j.data?.quote?.quoteNumber).toMatch(/^AUTO-/);

    const qvId = j.data!.quoteVersion!.id;
    const scopeRes = await fetch(`${baseUrl}/api/quote-versions/${qvId}/scope`, {
      headers: { Cookie: cookieOffice },
    });
    expect(scopeRes.status).toBe(200);
  });

  it("office: POST quote-shell then GET /api/quotes lists it and GET /api/quotes/[id] works; tenant B detail is 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `List Customer ${suffix}`,
        flowGroupName: `List FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const cj = (await createRes.json()) as { data?: { quote?: { id: string }; quoteVersion?: { id: string } } };
    const quoteId = cj.data?.quote?.id;
    expect(quoteId).toBeDefined();

    const listRes = await fetch(`${baseUrl}/api/quotes?limit=200`, {
      headers: { Cookie: cookieOffice },
    });
    expect(listRes.status).toBe(200);
    const lj = (await listRes.json()) as { data?: { items?: { quote?: { id: string } }[] } };
    expect(lj.data?.items?.some((i) => i.quote?.id === quoteId)).toBe(true);

    const detailRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}`, {
      headers: { Cookie: cookieOffice },
    });
    expect(detailRes.status).toBe(200);
    const dj = (await detailRes.json()) as { data?: { quote?: { id: string }; latestQuoteVersion?: { id: string } } };
    expect(dj.data?.quote?.id).toBe(quoteId);
    expect(dj.data?.latestQuoteVersion?.id).toBe(cj.data?.quoteVersion?.id);

    const crossRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(crossRes.status).toBe(404);
    const bj = (await crossRes.json()) as { error?: { code?: string } };
    expect(bj.error?.code).toBe("NOT_FOUND");
  });

  it("office: GET quote version history for created quote; tenant B is 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `Hist Customer ${suffix}`,
        flowGroupName: `Hist FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const cj = (await createRes.json()) as {
      data?: { quote?: { id: string }; quoteVersion?: { id: string; versionNumber?: number } };
    };
    const quoteId = cj.data?.quote?.id;
    const qvId = cj.data?.quoteVersion?.id;
    expect(quoteId).toBeDefined();

    const histRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      headers: { Cookie: cookieOffice },
    });
    expect(histRes.status).toBe(200);
    const hj = (await histRes.json()) as {
      data?: {
        quoteId?: string;
        quoteNumber?: string;
        versions?: {
          id: string;
          versionNumber: number;
          status: string;
          pinnedWorkflowVersionId?: string | null;
          hasPinnedWorkflow?: boolean;
          hasFrozenArtifacts?: boolean;
          hasActivation?: boolean;
          proposalGroupCount?: number;
        }[];
      };
    };
    expect(hj.data?.quoteId).toBe(quoteId);
    expect(hj.data?.versions?.length).toBeGreaterThanOrEqual(1);
    const v0 = hj.data?.versions?.[0];
    expect(v0?.id).toBe(qvId);
    expect(v0?.versionNumber).toBe(1);
    expect(v0?.status).toBe("DRAFT");
    expect(v0?.pinnedWorkflowVersionId ?? null).toBeNull();
    expect(v0?.hasPinnedWorkflow).toBe(false);
    expect(v0?.hasFrozenArtifacts).toBe(false);
    expect(v0?.hasActivation).toBe(false);
    expect(v0?.proposalGroupCount).toBe(1);

    const crossRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(crossRes.status).toBe(404);
    const bj = (await crossRes.json()) as { error?: { code?: string } };
    expect(bj.error?.code).toBe("NOT_FOUND");
  });

  it("rejects unauthenticated POST next quote version (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quotes/clocynvalidquoteid00000/versions`, { method: "POST" });
    expect(res.status).toBe(401);
  });

  it("READ_ONLY cannot office_mutate POST next quote version (403)", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `ReadonlyVer ${suffix}`,
        flowGroupName: `ReadonlyVer FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const quoteId = ((await createRes.json()) as { data?: { quote?: { id: string } } }).data?.quote?.id;
    expect(quoteId).toBeDefined();

    const res = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly },
    });
    expect(res.status).toBe(403);
  });

  it("office: POST next quote version clones head; prior version id unchanged; tenant B POST 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `NextVer ${suffix}`,
        flowGroupName: `NextVer FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const cj = (await createRes.json()) as {
      data?: { quote?: { id: string }; quoteVersion?: { id: string } };
    };
    const quoteId = cj.data?.quote?.id;
    const v1Id = cj.data?.quoteVersion?.id;
    expect(quoteId).toBeDefined();
    expect(v1Id).toBeDefined();

    const postRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      method: "POST",
      headers: { Cookie: cookieOffice },
    });
    expect(postRes.status).toBe(200);
    const pj = (await postRes.json()) as {
      data?: { quoteVersionId?: string; versionNumber?: number; proposalGroups?: { id: string }[] };
    };
    expect(pj.data?.versionNumber).toBe(2);
    expect(pj.data?.quoteVersionId).toBeDefined();
    expect(pj.data?.quoteVersionId).not.toBe(v1Id);
    expect(pj.data?.proposalGroups?.length).toBeGreaterThanOrEqual(1);

    const histRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      headers: { Cookie: cookieOffice },
    });
    expect(histRes.status).toBe(200);
    const hj = (await histRes.json()) as {
      data?: { versions?: { id: string; versionNumber: number; status: string }[] };
    };
    expect(hj.data?.versions?.length).toBe(2);
    expect(hj.data?.versions?.[0]?.versionNumber).toBe(2);
    expect(hj.data?.versions?.[0]?.id).toBe(pj.data?.quoteVersionId);
    expect(hj.data?.versions?.[1]?.versionNumber).toBe(1);
    expect(hj.data?.versions?.[1]?.id).toBe(v1Id);
    expect(hj.data?.versions?.[1]?.status).toBe("DRAFT");

    const crossPost = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      method: "POST",
      headers: { Cookie: cookieTenantB },
    });
    expect(crossPost.status).toBe(404);
  });

  it("office: GET quote workspace aggregates shell + versions; tenant B 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `Ws Customer ${suffix}`,
        flowGroupName: `Ws FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const cj = (await createRes.json()) as {
      data?: {
        quote?: { id: string; quoteNumber?: string };
        customer?: { id: string };
        flowGroup?: { id: string };
        quoteVersion?: { id: string };
      };
    };
    const quoteId = cj.data?.quote?.id;
    expect(quoteId).toBeDefined();

    const wsRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/workspace`, {
      headers: { Cookie: cookieOffice },
    });
    expect(wsRes.status).toBe(200);
    const wj = (await wsRes.json()) as {
      data?: {
        quote?: { id: string; quoteNumber?: string };
        customer?: { id: string };
        flowGroup?: { id: string };
        versions?: { id: string; versionNumber: number }[];
        latestQuoteVersionId?: string;
        routeHints?: {
          versionHistoryGet?: string;
          workflowVersionsListGet?: string;
          quoteVersionSignPost?: string;
          quoteVersionActivatePost?: string;
          flowExecutionGet?: string;
          jobShellGet?: string;
        };
      };
    };
    expect(wj.data?.quote?.id).toBe(quoteId);
    expect(wj.data?.customer?.id).toBe(cj.data?.customer?.id);
    expect(wj.data?.flowGroup?.id).toBe(cj.data?.flowGroup?.id);
    expect(wj.data?.versions?.length).toBeGreaterThanOrEqual(1);
    expect(wj.data?.latestQuoteVersionId).toBe(cj.data?.quoteVersion?.id);
    expect(wj.data?.routeHints?.versionHistoryGet).toContain("versions");
    expect(wj.data?.routeHints?.workflowVersionsListGet).toContain("workflow-versions");
    expect(wj.data?.routeHints?.quoteVersionSignPost).toContain("/sign");
    expect(wj.data?.routeHints?.quoteVersionActivatePost).toContain("/activate");
    expect(wj.data?.routeHints?.flowExecutionGet).toContain("/api/flows/");
    expect(wj.data?.routeHints?.jobShellGet).toContain("/api/jobs/");

    const crossWs = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/workspace`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(crossWs.status).toBe(404);
  });

  it("READ_ONLY can GET quote workspace (200) but cannot POST next version (403)", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `WsRo Customer ${suffix}`,
        flowGroupName: `WsRo FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const quoteId = ((await createRes.json()) as { data?: { quote?: { id: string } } }).data?.quote?.id;
    expect(quoteId).toBeDefined();

    const wsRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/workspace`, {
      headers: { Cookie: cookieReadOnly },
    });
    expect(wsRes.status).toBe(200);

    const postRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/versions`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly },
    });
    expect(postRes.status).toBe(403);
  });

  it("office: GET /api/customers lists tenant customers; detail 200; tenant B detail 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `CustList ${suffix}`,
        flowGroupName: `CustList FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const customerId = ((await createRes.json()) as { data?: { customer?: { id: string } } }).data?.customer?.id;
    expect(customerId).toBeDefined();

    const listRes = await fetch(`${baseUrl}/api/customers?limit=200`, {
      headers: { Cookie: cookieOffice },
    });
    expect(listRes.status).toBe(200);
    const lj = (await listRes.json()) as { data?: { items?: { id: string; name?: string }[] } };
    expect(lj.data?.items?.some((c) => c.id === customerId)).toBe(true);

    const detailRes = await fetch(`${baseUrl}/api/customers/${encodeURIComponent(customerId!)}`, {
      headers: { Cookie: cookieOffice },
    });
    expect(detailRes.status).toBe(200);
    const dj = (await detailRes.json()) as { data?: { id: string; name?: string } };
    expect(dj.data?.id).toBe(customerId);

    const crossRes = await fetch(`${baseUrl}/api/customers/${encodeURIComponent(customerId!)}`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(crossRes.status).toBe(404);
    const bj = (await crossRes.json()) as { error?: { code?: string } };
    expect(bj.error?.code).toBe("NOT_FOUND");
  });

  it("office: GET /api/flow-groups lists tenant flow groups; detail 200; tenant B detail 404", async () => {
    const suffix = Date.now();
    const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `FgList ${suffix}`,
        flowGroupName: `FgList FG ${suffix}`,
      }),
    });
    expect(createRes.status).toBe(200);
    const cj = (await createRes.json()) as {
      data?: { flowGroup?: { id: string }; customer?: { id: string; name?: string } };
    };
    const flowGroupId = cj.data?.flowGroup?.id;
    const customerId = cj.data?.customer?.id;
    expect(flowGroupId).toBeDefined();

    const listRes = await fetch(`${baseUrl}/api/flow-groups?limit=200`, {
      headers: { Cookie: cookieOffice },
    });
    expect(listRes.status).toBe(200);
    const lj = (await listRes.json()) as {
      data?: { items?: { id: string; customer?: { id: string } }[] };
    };
    const hit = lj.data?.items?.find((f) => f.id === flowGroupId);
    expect(hit).toBeDefined();
    expect(hit?.customer?.id).toBe(customerId);

    const detailRes = await fetch(`${baseUrl}/api/flow-groups/${encodeURIComponent(flowGroupId!)}`, {
      headers: { Cookie: cookieOffice },
    });
    expect(detailRes.status).toBe(200);
    const dj = (await detailRes.json()) as { data?: { id: string; customer?: { id: string } } };
    expect(dj.data?.id).toBe(flowGroupId);
    expect(dj.data?.customer?.id).toBe(customerId);

    const crossRes = await fetch(`${baseUrl}/api/flow-groups/${encodeURIComponent(flowGroupId!)}`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(crossRes.status).toBe(404);
    const bj = (await crossRes.json()) as { error?: { code?: string } };
    expect(bj.error?.code).toBe("NOT_FOUND");
  });

  it("office: attach customer + new flow group reuses customer", async () => {
    const suffix = Date.now();
    const seedRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `AttachSeed ${suffix}`,
        flowGroupName: `AttachSeed FG ${suffix}`,
      }),
    });
    expect(seedRes.status).toBe(200);
    const sj = (await seedRes.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    const customerId = sj.data?.customer?.id;
    expect(customerId).toBeDefined();

    const attachRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId,
        flowGroupName: `Second FG ${suffix}`,
      }),
    });
    expect(attachRes.status).toBe(200);
    const aj = (await attachRes.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    expect(aj.data?.customer?.id).toBe(customerId);
    expect(aj.data?.flowGroup?.id).not.toBe(sj.data?.flowGroup?.id);
  });

  it("office: attach customer + attach flow group reuses both", async () => {
    const suffix = Date.now();
    const seedRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `ReuseBoth ${suffix}`,
        flowGroupName: `ReuseBoth FG ${suffix}`,
      }),
    });
    expect(seedRes.status).toBe(200);
    const sj = (await seedRes.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    const customerId = sj.data?.customer?.id;
    const flowGroupId = sj.data?.flowGroup?.id;
    expect(customerId).toBeDefined();
    expect(flowGroupId).toBeDefined();

    const attachRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, flowGroupId }),
    });
    expect(attachRes.status).toBe(200);
    const aj = (await attachRes.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    expect(aj.data?.customer?.id).toBe(customerId);
    expect(aj.data?.flowGroup?.id).toBe(flowGroupId);
  });

  it("tenant B cannot attach tenant A customerId (404)", async () => {
    const suffix = Date.now();
    const seedRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: `CrossTenantCust ${suffix}`,
        flowGroupName: `CrossTenantFG ${suffix}`,
      }),
    });
    expect(seedRes.status).toBe(200);
    const customerId = ((await seedRes.json()) as { data?: { customer?: { id: string } } }).data?.customer?.id;
    expect(customerId).toBeDefined();

    const crossRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieTenantB, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, flowGroupName: "Should Fail" }),
    });
    expect(crossRes.status).toBe(404);
    const j = (await crossRes.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("CUSTOMER_NOT_FOUND");
  });

  it("office: flowGroupId not matching customerId returns FLOW_GROUP_CUSTOMER_MISMATCH (400)", async () => {
    const suffix = Date.now();
    const a = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: `MisA ${suffix}`, flowGroupName: `MisAfg ${suffix}` }),
    });
    const b = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: `MisB ${suffix}`, flowGroupName: `MisBfg ${suffix}` }),
    });
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    const aj = (await a.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    const bj = (await b.json()) as { data?: { customer?: { id: string }; flowGroup?: { id: string } } };
    const customerA = aj.data?.customer?.id;
    const flowGroupB = bj.data?.flowGroup?.id;
    expect(customerA).toBeDefined();
    expect(flowGroupB).toBeDefined();

    const bad = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: customerA, flowGroupId: flowGroupB }),
    });
    expect(bad.status).toBe(400);
    const z = (await bad.json()) as { error?: { code?: string } };
    expect(z.error?.code).toBe("FLOW_GROUP_CUSTOMER_MISMATCH");
  });

  it("quote-shell rejects customerName + customerId (400 SHELL_INPUT_CONFLICT)", async () => {
    const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "X",
        customerId: "clxxxxxxxxxxxxxxxxxxxxxxxxx",
        flowGroupName: "Y",
      }),
    });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("SHELL_INPUT_CONFLICT");
  });

  it("quote-shell rejects flowGroupId without customerId (400 SHELL_INPUT_CONFLICT)", async () => {
    const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
      body: JSON.stringify({ flowGroupId: "clxxxxxxxxxxxxxxxxxxxxxxxxx" }),
    });
    expect(res.status).toBe(400);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("SHELL_INPUT_CONFLICT");
  });

  it("READ_ONLY cannot office_mutate (403)", async () => {
    const res = await fetch(
      `${baseUrl}/api/quote-versions/${fx.quoteVersionId}/proposal-groups/${fx.proposalGroupId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Should-Fail" }),
      },
    );
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("READ_ONLY cannot field_execute (403)", async () => {
    const res = await fetch(`${baseUrl}/api/runtime-tasks/clocynvalidspinetask00000/start`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    expect(res.status).toBe(403);
  });

  it("READ_ONLY cannot office_mutate send (403)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/send`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({
        clientStalenessToken: null,
        sendClientRequestId: `smoke-readonly-${Date.now()}`,
      }),
    });
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated POST quote-version sign (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/sign`, { method: "POST" });
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("READ_ONLY cannot office_mutate POST sign (403)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/sign`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("rejects unauthenticated POST quote-version activate (401)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/activate`, { method: "POST" });
    expect(res.status).toBe(401);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("AUTHENTICATION_REQUIRED");
  });

  it("READ_ONLY cannot office_mutate POST activate (403)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/activate`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("READ_ONLY cannot office_mutate compose-preview (403)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/compose-preview`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("READ_ONLY cannot office_mutate PATCH quote-version pin (403)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}`, {
      method: "PATCH",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({ pinnedWorkflowVersionId: null }),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("READ_ONLY cannot office_mutate commercial quote-shell (403)", async () => {
    const res = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
      method: "POST",
      headers: { Cookie: cookieReadOnly, "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: "X", flowGroupName: "Y" }),
    });
    expect(res.status).toBe(403);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("INSUFFICIENT_ROLE");
  });

  it("FIELD_WORKER cannot office_mutate (403)", async () => {
    const res = await fetch(
      `${baseUrl}/api/quote-versions/${fx.quoteVersionId}/proposal-groups/${fx.proposalGroupId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieField, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "FieldCannotOffice" }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("tenant B session cannot read tenant A quote version (404, no leak)", async () => {
    const res = await fetch(`${baseUrl}/api/quote-versions/${fx.quoteVersionId}/scope`, {
      headers: { Cookie: cookieTenantB },
    });
    expect(res.status).toBe(404);
    const j = (await res.json()) as { error?: { code?: string } };
    expect(j.error?.code).toBe("NOT_FOUND");
  });

  it("FIELD_WORKER reaches field route (404 unknown task, not 403)", async () => {
    const res = await fetch(`${baseUrl}/api/runtime-tasks/clocynvalidspinetask00000/start`, {
      method: "POST",
      headers: { Cookie: cookieField, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    expect(res.status).toBe(404);
  });

  it.skipIf(!runtimeTaskId)("FIELD_WORKER starts runtime task when activation fixture exists", async () => {
    const rtId = runtimeTaskId!;
    const res = await fetch(`${baseUrl}/api/runtime-tasks/${rtId}/start`, {
      method: "POST",
      headers: { Cookie: cookieField, "Content-Type": "application/json" },
      body: JSON.stringify({ notes: null }),
    });
    expect([200, 409]).toContain(res.status);
    if (res.status === 200) {
      const j = (await res.json()) as { data?: { eventType?: string } };
      expect(j.data?.eventType).toBe("STARTED");
    }
  });

  it("tenant B cannot mutate tenant A proposal group (404)", async () => {
    const res = await fetch(
      `${baseUrl}/api/quote-versions/${fx.quoteVersionId}/proposal-groups/${fx.proposalGroupId}`,
      {
        method: "PATCH",
        headers: { Cookie: cookieTenantB, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "CrossTenantHack" }),
      },
    );
    expect(res.status).toBe(404);
  });

  it.skipIf(!activatedFlowId)("skeleton start: FIELD_WORKER allowed when flow + skeleton exist", async () => {
    const resFlow = await fetch(`${baseUrl}/api/flows/${activatedFlowId}`, {
      headers: { Cookie: cookieField },
    });
    expect(resFlow.status).toBe(200);
    const j = (await resFlow.json()) as { data?: { skeletonTasks?: { skeletonTaskId: string }[] } };
    const sk = j.data?.skeletonTasks?.[0]?.skeletonTaskId;
    expect(sk).toBeDefined();
    const res = await fetch(
      `${baseUrl}/api/flows/${activatedFlowId}/skeleton-tasks/${encodeURIComponent(sk!)}/start`,
      {
        method: "POST",
        headers: { Cookie: cookieField, "Content-Type": "application/json" },
        body: JSON.stringify({ notes: null }),
      },
    );
    expect([200, 409]).toContain(res.status);
  });

  /**
   * Full commercial lifecycle via real session + HTTP (no dev auth bypass).
   * Requires `npm run db:seed` after seed update so fixture.json includes seedPublished* ids.
   */
  it(
    "office: shell → pin → manifest line → compose → send → sign → activate → lifecycle + workspace show flow",
    async () => {
      if (!fx.seedPublishedWorkflowVersionId || !fx.seedPublishedScopePacketRevisionId) {
        throw new Error(
          "fixture.json missing seedPublishedWorkflowVersionId or seedPublishedScopePacketRevisionId — run npm run db:seed",
        );
      }

      const suffix = Date.now();
      const createRes = await fetch(`${baseUrl}/api/commercial/quote-shell`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: `E2E Customer ${suffix}`,
          flowGroupName: `E2E FlowGroup ${suffix}`,
        }),
      });
      expect(createRes.status).toBe(200);
      const cj = (await createRes.json()) as {
        data?: {
          quote?: { id: string };
          quoteVersion?: { id: string };
          proposalGroup?: { id: string };
        };
      };
      const quoteId = cj.data?.quote?.id;
      const qvId = cj.data?.quoteVersion?.id;
      const pgId = cj.data?.proposalGroup?.id;
      expect(quoteId).toBeDefined();
      expect(qvId).toBeDefined();
      expect(pgId).toBeDefined();

      const pinRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}`, {
        method: "PATCH",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedWorkflowVersionId: fx.seedPublishedWorkflowVersionId }),
      });
      expect(pinRes.status).toBe(200);

      const lineRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/line-items`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalGroupId: pgId,
          sortOrder: 1,
          executionMode: "MANIFEST",
          title: "E2E manifest line",
          quantity: 1,
          scopePacketRevisionId: fx.seedPublishedScopePacketRevisionId,
        }),
      });
      expect(lineRes.status).toBe(201);

      const composeRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/compose-preview`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(composeRes.status).toBe(200);
      const composeJ = (await composeRes.json()) as {
        data?: { stalenessToken?: string | null; errors?: unknown[] };
      };
      expect(composeJ.data?.errors?.length ?? 0).toBe(0);
      const tok = composeJ.data?.stalenessToken ?? null;

      const sendRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/send`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({
          clientStalenessToken: tok,
          sendClientRequestId: `e2e-chain-${suffix}`,
        }),
      });
      expect(sendRes.status).toBe(200);

      const signRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/sign`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(signRes.status).toBe(200);

      const actRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/activate`, {
        method: "POST",
        headers: { Cookie: cookieOffice, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(actRes.status).toBe(200);
      const actJ = (await actRes.json()) as { data?: { flowId?: string; activationId?: string } };
      expect(actJ.data?.flowId).toBeTruthy();
      expect(actJ.data?.activationId).toBeTruthy();

      const lcRes = await fetch(`${baseUrl}/api/quote-versions/${encodeURIComponent(qvId!)}/lifecycle`, {
        headers: { Cookie: cookieOffice },
      });
      expect(lcRes.status).toBe(200);
      const lcj = (await lcRes.json()) as {
        data?: { flow?: { id: string } | null; activation?: { id: string } | null };
      };
      expect(lcj.data?.flow?.id).toBe(actJ.data?.flowId);
      expect(lcj.data?.activation?.id).toBe(actJ.data?.activationId);

      const wsRes = await fetch(`${baseUrl}/api/quotes/${encodeURIComponent(quoteId!)}/workspace`, {
        headers: { Cookie: cookieOffice },
      });
      expect(wsRes.status).toBe(200);
      const wsj = (await wsRes.json()) as {
        data?: {
          versions?: { id: string; hasActivation: boolean }[];
          routeHints?: { flowExecutionGet?: string };
        };
      };
      const vRow = wsj.data?.versions?.find((v) => v.id === qvId);
      expect(vRow?.hasActivation).toBe(true);
      expect(wsj.data?.routeHints?.flowExecutionGet).toContain("/api/flows/");

      const flowGet = await fetch(`${baseUrl}/api/flows/${encodeURIComponent(actJ.data!.flowId!)}`, {
        headers: { Cookie: cookieOffice },
      });
      expect(flowGet.status).toBe(200);
    },
    120_000,
  );
});
