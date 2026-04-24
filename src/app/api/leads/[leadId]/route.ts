import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { updateLeadForTenant } from "@/server/slice1/mutations/lead-mutations";
import { getLeadForTenant } from "@/server/slice1/reads/lead-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ leadId: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { leadId } = await context.params;

  try {
    const item = await getLeadForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      leadId,
    });
    if (!item) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Lead not found for tenant." } },
        { status: 404 },
      );
    }
    return NextResponse.json({ data: item, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

type PatchBody = {
  displayName?: unknown;
  source?: unknown;
  primaryEmail?: unknown;
  primaryPhone?: unknown;
  summary?: unknown;
  assignedToUserId?: unknown;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { leadId } = await context.params;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }

  const input: Parameters<typeof updateLeadForTenant>[1]["input"] = {};
  if ("displayName" in body && typeof body.displayName === "string") input.displayName = body.displayName;
  if ("source" in body) input.source = typeof body.source === "string" || body.source === null ? body.source : undefined;
  if ("primaryEmail" in body) {
    input.primaryEmail =
      typeof body.primaryEmail === "string" || body.primaryEmail === null ? body.primaryEmail : undefined;
  }
  if ("primaryPhone" in body) {
    input.primaryPhone =
      typeof body.primaryPhone === "string" || body.primaryPhone === null ? body.primaryPhone : undefined;
  }
  if ("summary" in body) {
    input.summary = typeof body.summary === "string" || body.summary === null ? body.summary : undefined;
  }
  if ("assignedToUserId" in body) {
    input.assignedToUserId =
      typeof body.assignedToUserId === "string" || body.assignedToUserId === null
        ? body.assignedToUserId
        : undefined;
  }

  try {
    const result = await updateLeadForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      leadId,
      input,
    });

    if (!result.ok) {
      if (result.kind === "lead_not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lead not found." } }, { status: 404 });
      }
      if (result.kind === "lead_immutable") {
        return NextResponse.json(
          { error: { code: "LEAD_IMMUTABLE", message: "This lead cannot be edited in its current status." } },
          { status: 409 },
        );
      }
      if (result.kind === "no_changes") {
        return NextResponse.json({ error: { code: "NO_CHANGES", message: "No valid fields to update." } }, { status: 400 });
      }
      return NextResponse.json(
        { error: { code: "LEAD_UPDATE_REJECTED", message: result.kind } },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: { ok: true }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
