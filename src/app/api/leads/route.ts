import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { createLeadForTenant } from "@/server/slice1/mutations/lead-mutations";
import { clampLeadListLimit, listLeadsForTenant } from "@/server/slice1/reads/lead-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const limit = clampLeadListLimit(
    request.nextUrl.searchParams.get("limit") != null
      ? Number.parseInt(request.nextUrl.searchParams.get("limit")!, 10)
      : undefined,
  );

  try {
    const items = await listLeadsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      limit,
    });
    return NextResponse.json({
      data: { items, limit },
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

type PostBody = {
  displayName?: unknown;
  source?: unknown;
  primaryEmail?: unknown;
  primaryPhone?: unknown;
  summary?: unknown;
  assignedToUserId?: unknown;
};

export async function POST(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName : "";
  const source = typeof body.source === "string" || body.source === null ? (body.source as string | null) : undefined;
  const primaryEmail =
    typeof body.primaryEmail === "string" || body.primaryEmail === null
      ? (body.primaryEmail as string | null)
      : undefined;
  const primaryPhone =
    typeof body.primaryPhone === "string" || body.primaryPhone === null
      ? (body.primaryPhone as string | null)
      : undefined;
  const summary =
    typeof body.summary === "string" || body.summary === null ? (body.summary as string | null) : undefined;
  const assignedToUserId =
    typeof body.assignedToUserId === "string" || body.assignedToUserId === null
      ? (body.assignedToUserId as string | null)
      : undefined;

  try {
    const result = await createLeadForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      createdByUserId: authGate.principal.userId,
      input: {
        displayName,
        source: source ?? undefined,
        primaryEmail: primaryEmail ?? undefined,
        primaryPhone: primaryPhone ?? undefined,
        summary: summary ?? undefined,
        assignedToUserId: assignedToUserId ?? undefined,
      },
    });

    if (!result.ok) {
      const code =
        result.kind === "display_name_invalid"
          ? "LEAD_DISPLAY_NAME_INVALID"
          : result.kind === "field_too_long"
            ? "LEAD_FIELD_TOO_LONG"
            : result.kind === "assignee_not_in_tenant"
              ? "LEAD_ASSIGNEE_INVALID"
              : "LEAD_CREATE_REJECTED";
      return NextResponse.json(
        { error: { code, message: `Lead create failed: ${result.kind}.` } },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        data: { id: result.data.id },
        meta: apiAuthMeta(authGate.principal),
      },
      { status: 201 },
    );
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
