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
 * Duck-typed detection for Prisma init failures.
 *
 * `instanceof PrismaClientInitializationError` is unreliable under Turbopack /
 * Next.js dev: the Prisma runtime module can be loaded twice (once via
 * `@prisma/client`'s internal import graph, once via our direct
 * `@prisma/client/runtime/library` import), producing two distinct constructor
 * identities. We therefore also accept any error whose `name` is
 * `PrismaClientInitializationError` or whose `errorCode` is `P1001`
 * ("Can't reach database server"). This is the difference between a structured
 * 503 `DATABASE_UNAVAILABLE` JSON response and a silent `{}` 500.
 */
function isPrismaInitError(e: unknown): e is Error & { errorCode?: string } {
  if (e instanceof PrismaClientInitializationError) return true;
  if (!(e instanceof Error)) return false;
  if (e.name === "PrismaClientInitializationError") return true;
  const errorCode = (e as { errorCode?: unknown }).errorCode;
  return typeof errorCode === "string" && errorCode === "P1001";
}

/**
 * Map any caught error to a structured JSON `NextResponse`.
 *
 * Contract: ALWAYS returns a `NextResponse` — never `null`. Routes that catch
 * errors and call this helper are guaranteed a structured `{ error: { code,
 * message, ... } }` body and a meaningful status code. This prevents the
 * silent `{}` 500 that Next.js produces when an exception escapes a Route
 * Handler.
 *
 * Handled categories (in order):
 *   1. Prisma initialization failure (DB unreachable, P1001)         → 503 DATABASE_UNAVAILABLE
 *   2. Missing `DATABASE_URL` thrown by `getPrisma()`                 → 500 DATABASE_URL_MISSING
 *   3. `InvariantViolationError` (slice 1 service invariants)        → status from `invariantToHttpStatus`
 *   4. Anything else                                                 → 500 INTERNAL_ERROR
 *
 * For the `INTERNAL_ERROR` fallback, the underlying error is logged
 * server-side and a safe `details` block is included only outside production.
 */
export function jsonResponseForCaughtError(e: unknown): NextResponse {
  if (isPrismaInitError(e)) {
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

  console.error("[api] unhandled error in route handler:", e);

  const isProd = process.env.NODE_ENV === "production";
  const safeName = e instanceof Error ? e.name : typeof e;
  const safeMessage = e instanceof Error ? e.message : "Unknown server error.";
  const body = {
    error: {
      code: "INTERNAL_ERROR",
      message: isProd
        ? "An unexpected server error occurred. Check server logs for details."
        : safeMessage,
      ...(isProd ? {} : { details: { name: safeName } }),
    },
  };
  return NextResponse.json(body, { status: 500 });
}

function invariantToHttpStatus(code: Slice1InvariantCode): number {
  switch (code) {
    case "QUOTE_VERSION_NOT_DRAFT":
    case "TASK_DEFINITION_NOT_DRAFT":
    case "TASK_DEFINITION_INVALID_STATUS_TRANSITION":
    case "TASK_DEFINITION_TASK_KEY_TAKEN":
    case "QUOTE_LOCAL_PACKET_HAS_PINNING_LINES":
    case "QUOTE_LOCAL_PACKET_ITEM_LINE_KEY_TAKEN":
    case "SCOPE_PACKET_TASK_LINE_LINE_KEY_TAKEN":
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
    // Quote-local fork from PUBLISHED ScopePacketRevision: source-state conflict.
    // Canon: docs/canon/05-packet-canon.md §100-101, bridge-decision 03.
    case "SCOPE_PACKET_REVISION_FORK_NOT_PUBLISHED":
    // Revision-2 evolution create-DRAFT preflight conflicts (decision pack §3-5).
    // All three describe a state-conflict between the requested DRAFT-clone
    // transition and the current state of the source packet → 409.
    case "HOLD_RELEASE_NOT_ACTIVE":
    case "SCOPE_PACKET_TASK_LINE_MUTATION_NOT_DRAFT":
    case "SCOPE_PACKET_REVISION_CREATE_DRAFT_NO_PUBLISHED_SOURCE":
    case "SCOPE_PACKET_REVISION_CREATE_DRAFT_PACKET_HAS_DRAFT":
    case "WORKFLOW_TEMPLATE_KEY_TAKEN":
    case "WORKFLOW_TEMPLATE_DRAFT_VERSION_EXISTS":
    case "WORKFLOW_VERSION_PUBLISH_NOT_DRAFT":
    case "WORKFLOW_VERSION_SNAPSHOT_REPLACE_NOT_DRAFT":
    case "WORKFLOW_VERSION_FORK_SOURCE_INVALID":
      return 409;
    case "TASK_DEFINITION_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_ITEM_NOT_FOUND":
    case "QUOTE_LOCAL_PACKET_ITEM_TASK_DEFINITION_NOT_FOUND":
    case "CUSTOMER_CONTACT_PARENT_NOT_FOUND":
    case "CUSTOMER_CONTACT_NOT_FOUND":
    case "CUSTOMER_CONTACT_METHOD_NOT_FOUND":
    case "CUSTOMER_NOTE_PARENT_NOT_FOUND":
    case "CUSTOMER_NOTE_NOT_FOUND":
    case "CUSTOMER_NOTE_AUTHOR_NOT_FOUND":
    case "SCOPE_PACKET_TASK_LINE_NOT_FOUND":
    case "HOLD_NOT_FOUND":
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
    case "SCOPE_PACKET_REVISION_CREATE_DRAFT_SOURCE_HAS_NO_ITEMS":
    case "WORKFLOW_TEMPLATE_INVALID_KEY":
    case "WORKFLOW_TEMPLATE_INVALID_DISPLAY_NAME":
    case "WORKFLOW_TEMPLATE_INVALID_FIELD_LENGTH":
    case "WORKFLOW_VERSION_SNAPSHOT_INVALID":
    case "CUSTOMER_CONTACT_DISPLAY_NAME_INVALID":
    case "CUSTOMER_CONTACT_NOTES_TOO_LONG":
    case "CUSTOMER_CONTACT_METHOD_VALUE_INVALID":
    case "CUSTOMER_CONTACT_ROLE_INVALID":
    case "CUSTOMER_NOTE_BODY_INVALID":
    case "HOLD_INVALID_REASON":
    case "HOLD_RUNTIME_TASK_NOT_ON_JOB":
    case "SCOPE_PACKET_TASK_LINE_REORDER_AT_BOUNDARY":
    case "SCOPE_PACKET_TASK_LINE_EDIT_EMPTY_PATCH":
    case "SCOPE_PACKET_TASK_LINE_EDIT_EMBEDDED_FIELDS_ON_LIBRARY":
      return 400;
    case "CUSTOMER_NOTE_UPDATE_NOT_AUTHORIZED":
      return 403;
    default:
      return 422;
  }
}
