import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { PrismaClientInitializationError } from "@prisma/client/runtime/library";
import { resolveTenantIdForRequest } from "@/lib/auth/resolve-tenant-id";
import { InvariantViolationError, type Slice1InvariantCode } from "@/server/slice1/errors";

export type TenantContext = { tenantId: string; source: "env" | "header" };

/**
 * Resolve tenant for Route Handlers; returns a JSON NextResponse on failure.
 */
export function requireTenantJson(
  request: NextRequest,
): { ok: true; tenant: TenantContext } | { ok: false; response: NextResponse } {
  const tenantRes = resolveTenantIdForRequest(request);
  if (!tenantRes.ok) {
    if (tenantRes.reason === "header_forbidden_in_production") {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: {
              code: "TENANT_HEADER_FORBIDDEN",
              message:
                "x-struxient-tenant-id is not allowed in production unless STRUXIENT_ALLOW_TENANT_HEADER=true",
            },
          },
          { status: 403 },
        ),
      };
    }
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "TENANT_REQUIRED",
            message:
              "Set STRUXIENT_DEV_TENANT_ID or pass x-struxient-tenant-id (non-production only for header)",
          },
        },
        { status: 401 },
      ),
    };
  }
  return { ok: true, tenant: { tenantId: tenantRes.tenantId, source: tenantRes.source } };
}

/**
 * Map Prisma init, invariant, and Struxient env errors to JSON responses; returns null if unhandled (rethrow).
 */
export function jsonResponseForCaughtError(e: unknown): NextResponse | null {
  if (e instanceof PrismaClientInitializationError) {
    return NextResponse.json(
      {
        error: {
          code: "DATABASE_UNAVAILABLE",
          message: e.message,
          hint: "Set DATABASE_URL in .env or .env.local and ensure Postgres is running; restart next dev.",
        },
      },
      { status: 503 },
    );
  }
  if (e instanceof Error && e.message.startsWith("[Struxient] DATABASE_URL")) {
    return NextResponse.json({ error: { code: "DATABASE_URL_MISSING", message: e.message } }, { status: 500 });
  }
  if (e instanceof InvariantViolationError) {
    const status = invariantToHttpStatus(e.code);
    return NextResponse.json(
      { error: { code: e.code, message: e.message, context: e.context ?? null } },
      { status },
    );
  }
  return null;
}

function invariantToHttpStatus(code: Slice1InvariantCode): number {
  switch (code) {
    case "QUOTE_VERSION_NOT_DRAFT":
      return 409;
    case "INVALID_PROPOSAL_GROUP_NAME":
    case "INVALID_LINE_QUANTITY":
    case "INVALID_LINE_SORT_ORDER":
    case "INVALID_LINE_TITLE":
    case "INVALID_LINE_DESCRIPTION":
    case "INVALID_LINE_MONEY":
    case "SCOPE_PACKET_REVISION_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_NOT_FOUND":
    case "PINNED_WORKFLOW_VERSION_NOT_FOUND":
    case "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED":
      return 400;
    default:
      return 422;
  }
}
