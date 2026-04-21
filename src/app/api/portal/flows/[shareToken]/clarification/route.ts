import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requestFlowShareClarification } from "@/server/slice1/mutations/flow-share-response";

type RouteContext = { params: Promise<{ shareToken: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { shareToken } = await context.params;

  try {
    const body = await request.json();
    if (typeof body.reason !== "string" || !body.reason.trim()) {
      return NextResponse.json(
        { error: { code: "INVALID_BODY", message: "Clarification reason is required." } },
        { status: 400 }
      );
    }

    const result = await requestFlowShareClarification(getPrisma(), { 
        shareToken, 
        reason: body.reason.trim() 
    });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: e.message } },
      { status: 400 }
    );
  }
}
