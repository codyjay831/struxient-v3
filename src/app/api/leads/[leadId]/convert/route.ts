import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { convertLeadToQuoteShellForTenant } from "@/server/slice1/mutations/convert-lead-to-quote-shell";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ leadId: string }> };

type PostBody = {
  customerName?: unknown;
  flowGroupName?: unknown;
  quoteNumber?: unknown;
  proposalGroupName?: unknown;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { leadId } = await context.params;

  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }

  const customerName = typeof body.customerName === "string" ? body.customerName : "";
  const flowGroupName = typeof body.flowGroupName === "string" ? body.flowGroupName : "";
  const quoteNumber =
    typeof body.quoteNumber === "string" || body.quoteNumber === null ? (body.quoteNumber as string | null) : null;
  const proposalGroupName =
    typeof body.proposalGroupName === "string" || body.proposalGroupName === null
      ? (body.proposalGroupName as string | null)
      : null;

  try {
    const result = await convertLeadToQuoteShellForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      actorUserId: authGate.principal.userId,
      leadId,
      input: { customerName, flowGroupName, quoteNumber, proposalGroupName },
    });

    if (!result.ok) {
      switch (result.kind) {
        case "lead_not_found":
          return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lead not found." } }, { status: 404 });
        case "lead_already_converted":
          return NextResponse.json(
            { error: { code: "LEAD_ALREADY_CONVERTED", message: "This lead was already converted." } },
            { status: 409 },
          );
        case "lead_not_open":
          return NextResponse.json(
            { error: { code: "LEAD_NOT_OPEN", message: "Only OPEN leads can be converted." } },
            { status: 400 },
          );
        case "lead_concurrent_convert":
          return NextResponse.json(
            { error: { code: "LEAD_CONVERT_RACE", message: "Lead was modified by another request; retry." } },
            { status: 409 },
          );
        case "quote_number_taken":
          return NextResponse.json(
            { error: { code: "QUOTE_NUMBER_TAKEN", message: "quoteNumber is already in use." } },
            { status: 409 },
          );
        default:
          return NextResponse.json(
            { error: { code: "CONVERT_FAILED", message: result.kind } },
            { status: 400 },
          );
      }
    }

    return NextResponse.json({
      data: result.data,
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
