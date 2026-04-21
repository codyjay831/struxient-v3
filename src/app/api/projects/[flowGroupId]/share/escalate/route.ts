import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { escalateProjectShareClarificationForTenant } from "@/server/slice1/mutations/project-share-response";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowGroupId } = await context.params;
  const auth = await requireApiPrincipal();
  if (!auth.ok) return auth.response;

  try {
    const prisma = getPrisma();
    await escalateProjectShareClarificationForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      flowGroupId,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Project Clarification Escalation Error:", e);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to escalate clarification" } }, { status: 500 });
  }
}
