import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { setPinnedWorkflowVersionForTenant } from "@/server/slice1/mutations/set-pinned-workflow-version";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

/**
 * Patch quote version shell fields (draft only). Currently: `pinnedWorkflowVersionId`.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON" } }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "Body must be an object" } }, { status: 400 });
  }

  const rec = body as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(rec, "pinnedWorkflowVersionId")) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELD", message: "Field `pinnedWorkflowVersionId` is required (use null to clear)." } },
      { status: 400 },
    );
  }

  const pin = rec.pinnedWorkflowVersionId;
  if (pin !== null && typeof pin !== "string") {
    return NextResponse.json(
      { error: { code: "INVALID_PINNED_WORKFLOW", message: "`pinnedWorkflowVersionId` must be a string or null." } },
      { status: 400 },
    );
  }

  try {
    const result = await setPinnedWorkflowVersionForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      pinnedWorkflowVersionId: pin,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
