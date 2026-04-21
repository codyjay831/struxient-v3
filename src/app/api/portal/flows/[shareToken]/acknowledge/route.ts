import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { acknowledgeFlowShareReceipt } from "@/server/slice1/mutations/flow-share-response";

type RouteContext = { params: Promise<{ shareToken: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { shareToken } = await context.params;

  try {
    const result = await acknowledgeFlowShareReceipt(getPrisma(), { shareToken });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { error: { code: "BAD_REQUEST", message: e.message } },
      { status: 400 }
    );
  }
}
