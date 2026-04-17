import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { renameProposalGroupForTenant } from "@/server/slice1/mutations/rename-proposal-group";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = {
  params: Promise<{ quoteVersionId: string; proposalGroupId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId, proposalGroupId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON" } }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: { code: "INVALID_BODY", message: "Body must be an object" } }, { status: 400 });
  }

  const name = (body as Record<string, unknown>).name;
  if (typeof name !== "string") {
    return NextResponse.json({ error: { code: "INVALID_NAME", message: "Field `name` must be a string" } }, { status: 400 });
  }

  try {
    const result = await renameProposalGroupForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      proposalGroupId,
      name,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Proposal group not found for tenant / version" } },
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
