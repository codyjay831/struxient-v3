import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { toQuoteVersionFreezeApiDto } from "@/lib/quote-version-freeze-dto";
import { getQuoteVersionFreezeReadModel } from "@/server/slice1/reads/quote-version-freeze";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

/**
 * Read-only frozen plan + package JSON for SENT versions (`06-send-freeze-transaction-design.md` § read-only sent view).
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  try {
    const prisma = getPrisma();
    const exists = await prisma.quoteVersion.findFirst({
      where: { id: quoteVersionId, quote: { tenantId: authGate.principal.tenantId } },
      select: { id: true, status: true },
    });

    if (!exists) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version not found for tenant" } },
        { status: 404 },
      );
    }

    const freezeReadable =
      exists.status === "SENT" ||
      exists.status === "SIGNED" ||
      exists.status === "DECLINED" ||
      exists.status === "VOID" ||
      exists.status === "SUPERSEDED";
    if (!freezeReadable) {
      return NextResponse.json(
        {
          error: {
            code: "QUOTE_VERSION_NOT_FROZEN",
            message:
              "Freeze payloads exist only after send (including superseded/voided rows that retain snapshots); use GET …/scope for draft authoring state.",
          },
        },
        { status: 409 },
      );
    }

    const model = await getQuoteVersionFreezeReadModel(prisma, {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
    });

    if (!model) {
      return NextResponse.json(
        {
          error: {
            code: "FREEZE_PAYLOAD_INCOMPLETE",
            message: "Sent version is missing plan or package snapshot blobs or integrity fields.",
          },
        },
        { status: 409 },
      );
    }

    return NextResponse.json({
      data: toQuoteVersionFreezeApiDto(model),
      meta: apiAuthMeta(authGate.principal),
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
