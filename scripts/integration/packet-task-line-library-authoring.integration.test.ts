/**
 * Epic 16: supported EMBEDDED `PacketTaskLine` authoring on library DRAFT revisions (HTTP).
 *
 * Prereqs: same as scope-packet-revision-publish.integration.test.ts (dev server, seed, AUTH_SECRET).
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

async function greenfieldPacket(
  baseUrl: string,
  cookie: string,
  displayName: string,
  packetKey: string,
): Promise<{ scopePacketId: string; scopePacketRevisionId: string }> {
  const res = await fetch(`${baseUrl}/api/scope-packets`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify({ displayName, packetKey }),
  });
  expect(res.status).toBe(201);
  const j = (await res.json()) as {
    data?: {
      scopePacket: { id: string };
      scopePacketRevision: { id: string; status: string };
    };
  };
  expect(j.data?.scopePacketRevision.status).toBe("DRAFT");
  return {
    scopePacketId: j.data!.scopePacket.id,
    scopePacketRevisionId: j.data!.scopePacketRevision.id,
  };
}

async function postEmbeddedTaskLine(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
  scopePacketRevisionId: string,
  body: { lineKey: string; targetNodeKey: string; title: string; taskKind?: string },
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(
      scopePacketRevisionId,
    )}/task-lines`,
    {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

async function publishRevision(
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

async function deleteTaskLine(
  baseUrl: string,
  cookie: string,
  scopePacketId: string,
  scopePacketRevisionId: string,
  packetTaskLineId: string,
): Promise<Response> {
  return fetch(
    `${baseUrl}/api/scope-packets/${encodeURIComponent(scopePacketId)}/revisions/${encodeURIComponent(
      scopePacketRevisionId,
    )}/task-lines/${encodeURIComponent(packetTaskLineId)}`,
    { method: "DELETE", headers: { Cookie: cookie } },
  );
}

describe("library packet task-line authoring (HTTP API)", () => {
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

  it("greenfield → POST task-lines → publish succeeds", async () => {
    const suffix = `${Date.now()}-tl-happy`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const packetKey = `gf-tl-${suffix}`;
    const { scopePacketId, scopePacketRevisionId } = await greenfieldPacket(
      baseUrl,
      cookieOffice,
      `TL happy ${suffix}`,
      packetKey,
    );

    const add = await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "first-line",
      targetNodeKey: "install-node",
      title: "Install work",
      taskKind: "INSTALL",
    });
    expect(add.status).toBe(201);
    const addJ = (await add.json()) as {
      data?: { scopePacketRevisionDetail?: { packetTaskLines: { lineKey: string }[] } };
    };
    expect(addJ.data?.scopePacketRevisionDetail?.packetTaskLines?.length).toBe(1);

    const pub = await publishRevision(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(pub.status).toBe(200);
    const pubJ = (await pub.json()) as { data?: { publish?: { status: string } } };
    expect(pubJ.data?.publish?.status).toBe("PUBLISHED");
  });

  it("DELETE task-line on PUBLISHED revision returns 409 NOT_DRAFT", async () => {
    const suffix = `${Date.now()}-tl-del`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const packetKey = `gf-tl-del-${suffix}`;
    const { scopePacketId, scopePacketRevisionId } = await greenfieldPacket(
      baseUrl,
      cookieOffice,
      `TL del ${suffix}`,
      packetKey,
    );
    const add = await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "to-delete",
      targetNodeKey: "n",
      title: "T",
    });
    expect(add.status).toBe(201);
    const addJ = (await add.json()) as { data?: { line?: { id: string } } };
    const lineId = addJ.data?.line?.id;
    expect(lineId).toBeTruthy();

    const pub = await publishRevision(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(pub.status).toBe(200);

    const del = await deleteTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, lineId!);
    expect(del.status).toBe(409);
    const j = (await del.json()) as ApiError;
    expect(j.error?.code).toBe("SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT");
  });

  it("POST task-lines on PUBLISHED revision returns 409 NOT_DRAFT", async () => {
    const suffix = `${Date.now()}-tl-pub`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const packetKey = `gf-tl-pub-${suffix}`;
    const { scopePacketId, scopePacketRevisionId } = await greenfieldPacket(
      baseUrl,
      cookieOffice,
      `TL pub ${suffix}`,
      packetKey,
    );
    await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "only",
      targetNodeKey: "n",
      title: "T",
    });
    const pub = await publishRevision(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId);
    expect(pub.status).toBe(200);

    const again = await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "second",
      targetNodeKey: "n2",
      title: "T2",
    });
    expect(again.status).toBe(409);
    const j = (await again.json()) as ApiError;
    expect(j.error?.code).toBe("SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT");
  });

  it("duplicate lineKey on same revision returns 409", async () => {
    const suffix = `${Date.now()}-tl-dup`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const packetKey = `gf-tl-dup-${suffix}`;
    const { scopePacketId, scopePacketRevisionId } = await greenfieldPacket(
      baseUrl,
      cookieOffice,
      `TL dup ${suffix}`,
      packetKey,
    );
    const first = await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "same-key",
      targetNodeKey: "n",
      title: "One",
    });
    expect(first.status).toBe(201);
    const second = await postEmbeddedTaskLine(baseUrl, cookieOffice, scopePacketId, scopePacketRevisionId, {
      lineKey: "same-key",
      targetNodeKey: "n2",
      title: "Two",
    });
    expect(second.status).toBe(409);
    const j = (await second.json()) as ApiError;
    expect(j.error?.code).toBe("SCOPE_PACKET_TASK_LINE_LINE_KEY_TAKEN");
  });

  it("tenant B cannot POST task-lines on tenant A revision (404)", async () => {
    const suffix = `${Date.now()}-tl-iso`.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const packetKey = `gf-tl-iso-${suffix}`;
    const { scopePacketId, scopePacketRevisionId } = await greenfieldPacket(
      baseUrl,
      cookieOffice,
      `TL iso ${suffix}`,
      packetKey,
    );
    const cross = await postEmbeddedTaskLine(baseUrl, cookieTenantB, scopePacketId, scopePacketRevisionId, {
      lineKey: "x",
      targetNodeKey: "n",
      title: "T",
    });
    expect(cross.status).toBe(404);
    const j = (await cross.json()) as ApiError;
    expect(j.error?.code).toBe("NOT_FOUND");
  });
});
