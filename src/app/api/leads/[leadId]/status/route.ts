import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { LeadStatus } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { setLeadStatusForTenant } from "@/server/slice1/mutations/lead-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

const ALLOWED: LeadStatus[] = ["OPEN", "ON_HOLD", "NURTURE", "LOST", "ARCHIVED"];

type RouteContext = { params: Promise<{ leadId: string }> };

type PostBody = {
  nextStatus?: unknown;
  lostReason?: unknown;
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

  if (typeof body.nextStatus !== "string" || !ALLOWED.includes(body.nextStatus as LeadStatus)) {
    return NextResponse.json(
      { error: { code: "INVALID_STATUS", message: "nextStatus must be a valid lead status for manual updates." } },
      { status: 400 },
    );
  }

  const lostReason =
    typeof body.lostReason === "string" || body.lostReason === null || body.lostReason === undefined
      ? (body.lostReason as string | null | undefined)
      : undefined;

  try {
    const result = await setLeadStatusForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      leadId,
      input: {
        nextStatus: body.nextStatus as LeadStatus,
        lostReason: lostReason === undefined ? undefined : lostReason,
      },
    });

    if (!result.ok) {
      if (result.kind === "lead_not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Lead not found." } }, { status: 404 });
      }
      if (result.kind === "lead_immutable") {
        return NextResponse.json(
          { error: { code: "LEAD_IMMUTABLE", message: "Lead status cannot be changed (converted)." } },
          { status: 409 },
        );
      }
      if (result.kind === "cannot_set_converted_via_status") {
        return NextResponse.json(
          { error: { code: "INVALID_STATUS", message: "CONVERTED is set only by the convert flow." } },
          { status: 400 },
        );
      }
      if (result.kind === "lost_reason_too_long") {
        return NextResponse.json(
          { error: { code: "LOST_REASON_TOO_LONG", message: "lostReason exceeds maximum length." } },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: { code: "INVALID_STATUS_TRANSITION", message: "This status change is not allowed." } },
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
