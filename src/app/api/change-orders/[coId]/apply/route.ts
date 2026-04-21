import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { applyChangeOrderForJob } from "@/server/slice1/mutations/apply-change-order";
import { NextResponse } from "next/server";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ coId: string }> }
) {
  const { coId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await applyChangeOrderForJob(getPrisma(), {
    tenantId: auth.principal.tenantId,
    changeOrderId: coId,
    appliedByUserId: auth.principal.userId,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
