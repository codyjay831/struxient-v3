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
    case "TASK_DEFINITION_NOT_DRAFT":
    case "TASK_DEFINITION_INVALID_STATUS_TRANSITION":
    case "TASK_DEFINITION_TASK_KEY_TAKEN":
    case "QUOTE_LOCAL_PACKET_HAS_PINNING_LINES":
    case "QUOTE_LOCAL_PACKET_ITEM_LINE_KEY_TAKEN":
    case "QUOTE_LOCAL_PACKET_PROMOTION_PACKET_KEY_TAKEN":
    case "QUOTE_LOCAL_PACKET_PROMOTION_ALREADY_PROMOTED":
    // Resource exists but is in the wrong lifecycle state for the requested
    // pin action — semantically a Conflict, not a Bad Request.
    case "LINE_SCOPE_REVISION_NOT_PUBLISHED":
    // Interim publish action — DRAFT → PUBLISHED preflight conflicts. All three
    // describe a state-conflict between the requested transition and current
    // resource state, so 409 is the right semantic match.
    // Canon: docs/implementation/decision-packs/interim-publish-authority-decision-pack.md.
    case "SCOPE_PACKET_REVISION_PUBLISH_NOT_DRAFT":
    case "SCOPE_PACKET_REVISION_PUBLISH_NOT_READY":
    case "SCOPE_PACKET_REVISION_PUBLISH_PACKET_HAS_PUBLISHED":
    // Quote-local fork from PUBLISHED ScopePacketRevision: source-state conflict.
    // Canon: docs/canon/05-packet-canon.md §100-101, bridge-decision 03.
    case "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED":
      return 409;
    case "TASK_DEFINITION_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_ITEM_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND":
      return 404;
    case "INVALID_PROPOSAL_GROUP_NAME":
    case "INVALID_LINE_QUANTITY":
    case "INVALID_LINE_SORT_ORDER":
    case "INVALID_LINE_TITLE":
    case "INVALID_LINE_DESCRIPTION":
    case "INVALID_LINE_MONEY":
    case "SCOPE_PACKET_REVISION_NOT_FOUND":
    case "PINNED_WORKFLOW_VERSION_NOT_FOUND":
    case "PINNED_WORKFLOW_VERSION_NOT_PUBLISHED":
    case "TASK_DEFINITION_TASK_KEY_INVALID":
    case "TASK_DEFINITION_DISPLAY_NAME_INVALID":
    case "TASK_DEFINITION_INSTRUCTIONS_TOO_LONG":
    case "TASK_DEFINITION_REQUIREMENTS_INVALID":
    case "TASK_DEFINITION_CONDITIONAL_RULES_INVALID":
    case "QUOTE_LOCAL_PACKET_INVALID_DISPLAY_NAME":
    case "QUOTE_LOCAL_PACKET_INVALID_DESCRIPTION":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KEY":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_SORT_ORDER":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_TARGET_NODE_KEY":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_TIER_CODE":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_LINE_KIND":
    case "QUOTE_LOCAL_PACKET_ITEM_INVALID_EMBEDDED_PAYLOAD":
    case "QUOTE_LOCAL_PACKET_ITEM_LIBRARY_WITHOUT_DEFINITION":
    case "QUOTE_LOCAL_PACKET_ITEM_EMBEDDED_WITHOUT_PAYLOAD":
    case "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_PACKET_KEY":
    case "QUOTE_LOCAL_PACKET_PROMOTION_INVALID_DISPLAY_NAME":
    case "QUOTE_LOCAL_PACKET_PROMOTION_SOURCE_HAS_NO_ITEMS":
    case "SCOPE_PACKET_REVISION_FORK_SOURCE_HAS_NO_ITEMS":
      return 400;
    default:
      return 422;
  }
}
