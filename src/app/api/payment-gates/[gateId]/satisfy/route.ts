import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { satisfyPaymentGateForTenant } from "@/server/slice1/mutations/satisfy-payment-gate";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ gateId: string }> },
) {
  const { gateId } = await params;
  const auth = await tryGetApiPrincipal();

  if (!auth.ok) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Sign in required" } }, { status: 401 });
  }

  const result = await satisfyPaymentGateForTenant(getPrisma(), {
    tenantId: auth.principal.tenantId,
    paymentGateId: gateId,
    actorUserId: auth.principal.userId,
  });

  if (!result.ok) {
    switch (result.kind) {
      case "not_found":
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Gate not found" } }, { status: 404 });
      case "already_satisfied":
        return NextResponse.json({ error: { code: "ALREADY_SATISFIED", message: "Gate is already satisfied" } }, { status: 409 });
      case "invalid_actor":
        return NextResponse.json({ error: { code: "FORBIDDEN", message: "Invalid actor" } }, { status: 403 });
    }
  }

  return NextResponse.json({ data: result.data });
}
