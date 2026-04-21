import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { acknowledgeProjectShareReceipt } from "@/server/slice1/mutations/project-share-response";

type RouteContext = { params: Promise<{ shareToken: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { shareToken } = await context.params;

  try {
    const prisma = getPrisma();
    await acknowledgeProjectShareReceipt(prisma, { shareToken });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("Project Acknowledgment Error:", e);
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: e.message } }, { status: 400 });
  }
}
