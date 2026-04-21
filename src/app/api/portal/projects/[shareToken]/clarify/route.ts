import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requestProjectShareClarification } from "@/server/slice1/mutations/project-share-response";

type RouteContext = { params: Promise<{ shareToken: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { shareToken } = await context.params;
  const { reason } = await request.json();

  if (!reason || typeof reason !== "string") {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Clarification reason is required." } }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    await requestProjectShareClarification(prisma, { shareToken, reason });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Project Clarification Request Error:", e);
    const message = e instanceof Error ? e.message : "Failed to request clarification";
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message } }, { status: 500 });
  }
}
