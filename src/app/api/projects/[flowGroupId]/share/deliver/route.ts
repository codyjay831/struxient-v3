import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { sendProjectShareForTenant } from "@/server/slice1/mutations/project-share-delivery";

type RouteContext = { params: Promise<{ flowGroupId: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowGroupId } = await context.params;
  const auth = await requireApiPrincipal();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { method, recipientDetail } = body;
    const baseUrl = new URL(request.url).origin;

    if (!method || !recipientDetail) {
      return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Method and recipient detail required" } }, { status: 400 });
    }

    const prisma = getPrisma();
    const result = await sendProjectShareForTenant(prisma, {
      tenantId: auth.principal.tenantId,
      flowGroupId,
      actorUserId: auth.principal.userId,
      request: { method, recipientDetail, baseUrl }
    });

    if (!result.ok) {
      if (result.kind === "not_found") return NextResponse.json({ error: { code: "NOT_FOUND", message: "Project not found" } }, { status: 404 });
      if (result.kind === "not_published") return NextResponse.json({ error: { code: "NOT_PUBLISHED", message: "Project must be published before sharing" } }, { status: 400 });
      return NextResponse.json({ error: { code: "INVALID_ACTOR", message: "Invalid actor" } }, { status: 403 });
    }

    return NextResponse.json({ deliveryId: result.data.deliveryId });
  } catch (e) {
    console.error("Project Delivery Error:", e);
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Failed to deliver project share" } }, { status: 500 });
  }
}
