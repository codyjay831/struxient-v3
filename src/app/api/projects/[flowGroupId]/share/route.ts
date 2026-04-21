import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { manageProjectShareForTenant } from "@/server/slice1/mutations/project-share";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowGroupId } = await context.params;
  const auth = await requireApiPrincipal();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, expiresAt } = body;

    if (!action) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Action required" } }, { status: 400 });
    }

    const prisma = getPrisma();
    const result = await manageProjectShareForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      flowGroupId,
      actorUserId: auth.principal.userId,
      action,
      expiresAt: expiresAt ? new Date(expiresAt) : expiresAt === null ? null : undefined
    });

    return NextResponse.json(result.data);
  } catch (e) {
    console.error("Project Share Management Error:", e);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to manage project share" } }, { status: 500 });
  }
}
