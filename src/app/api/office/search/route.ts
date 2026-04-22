import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import {
  OFFICE_SEARCH_QUERY_MAX_LEN,
  OFFICE_SEARCH_QUERY_MIN_LEN,
  searchOfficeTenantAnchors,
} from "@/server/slice1/reads/office-tenant-search-reads";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

/** Epic 58 — tenant-scoped quick search (substring / ILIKE); not a search platform. */
export async function GET(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("read");
  if (!authGate.ok) return authGate.response;

  const q = request.nextUrl.searchParams.get("q");
  const limitRaw = request.nextUrl.searchParams.get("limit");
  const limitPerSection =
    limitRaw != null && limitRaw !== "" ? Number.parseInt(limitRaw, 10) : undefined;
  if (limitPerSection != null && (Number.isNaN(limitPerSection) || limitPerSection < 1)) {
    return NextResponse.json(
      { error: { code: "INVALID_LIMIT", message: "limit must be a positive integer when provided." } },
      { status: 400 },
    );
  }

  try {
    const model = await searchOfficeTenantAnchors(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      query: q,
      limitPerSection: limitPerSection ?? undefined,
    });
    return NextResponse.json({
      data: model,
      meta: {
        ...apiAuthMeta(authGate.principal),
        notes: [
          "Substring match only (PostgreSQL case-insensitive contains). No semantic ranking.",
          `Sections are fixed order; within a section, rows are recent-first (or id desc where no timestamp).`,
          `Query must be ${OFFICE_SEARCH_QUERY_MIN_LEN}-${OFFICE_SEARCH_QUERY_MAX_LEN} characters; shorter/longer returns refusal without scanning.`,
          "Searches: customers, quotes, projects (flow groups), jobs, flows, library packets / task defs / process templates.",
        ],
      },
    });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
