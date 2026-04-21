import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { requireApiPrincipal } from "@/lib/auth/api-principal";
import { getStorageProvider } from "@/server/media/get-storage-provider";

type RouteContext = { params: Promise<{ storageKey: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { storageKey } = await context.params;
  const { searchParams } = new URL(request.url);
  const shareToken = searchParams.get("token");

  const authGate = shareToken ? null : await requireApiPrincipal();
  if (!shareToken && authGate && !authGate.ok) return authGate.response;

  try {
    const prisma = getPrisma();
    const where: any = { storageKey };
    if (shareToken) {
      where.completionProof = {
        taskExecution: {
          flow: { 
            publicShareToken: shareToken,
            publicShareStatus: "PUBLISHED",
            OR: [
              { publicShareExpiresAt: null },
              { publicShareExpiresAt: { gt: new Date() } }
            ]
          }
        }
      };
    } else if (authGate) {
      where.tenantId = authGate.principal.tenantId;
    }

    const attachment = await prisma.completionProofAttachment.findFirst({
      where,
      select: { id: true }
    });

    if (!attachment) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Media not found for tenant" } }, { status: 404 });
    }

    const download = await getStorageProvider().download(storageKey);
    if (!download) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Media file missing from storage" } }, { status: 404 });
    }

    return new Response(download.buffer, {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": `inline; filename="${download.fileName}"`,
        "Cache-Control": "private, max-age=3600"
      }
    });
  } catch (e) {
    console.error("Media Download Error:", e);
    return NextResponse.json({ error: { code: "DOWNLOAD_FAILED", message: "Failed to download media" } }, { status: 500 });
  }
}
