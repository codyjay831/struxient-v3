import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { resolveProjectShareClarificationForTenant } from "@/server/slice1/mutations/project-share-response";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowGroupId } = await context.params;
  const { note } = await request.json();
  const auth = await requireApiPrincipal();
  if (!auth.ok) return auth.response;

  try {
    const prisma = getPrisma();
    await resolveProjectShareClarificationForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      flowGroupId,
      note
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Project Clarification Resolution Error:", e);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to resolve clarification" } }, { status: 500 });
  }
}
