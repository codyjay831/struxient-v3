import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { markProjectShareNotificationSeenForTenant } from "@/server/slice1/mutations/project-share-response";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowGroupId } = await context.params;
  const auth = await requireApiPrincipal();
  if (!auth.ok) return auth.response;

  try {
    const prisma = getPrisma();
    await markProjectShareNotificationSeenForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      flowGroupId
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Project Notification Seen Error:", e);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to mark notification as seen" } }, { status: 500 });
  }
}
