import { tryGetApiPrincipal } from "@/lib/auth/api-principal";
import { getPrisma } from "@/server/db/prisma";
import { createChangeOrderForJob } from "@/server/slice1/mutations/create-change-order";
import { listChangeOrdersForJob } from "@/server/slice1/reads/change-order-reads";
import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items = await listChangeOrdersForJob(getPrisma(), {
    tenantId: auth.principal.tenantId,
    jobId,
  });

  return NextResponse.json({ items });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const auth = await tryGetApiPrincipal();
  if (!auth.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const reason = typeof body.reason === "string" ? body.reason : "No reason provided";

  const result = await createChangeOrderForJob(getPrisma(), {
    tenantId: auth.principal.tenantId,
    jobId,
    reason,
    createdById: auth.principal.userId,
  });

  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }

  return NextResponse.json(result);
}
