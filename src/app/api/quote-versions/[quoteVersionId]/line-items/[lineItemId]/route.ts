import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { QuoteLineItemExecutionMode } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import {
  deleteQuoteLineItemForTenant,
  updateQuoteLineItemForTenant,
  type QuoteLineItemPatch,
} from "@/server/slice1/mutations/quote-line-item-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string; lineItemId: string }> };

const EXECUTION_MODES = new Set<string>(["SOLD_SCOPE", "MANIFEST"]);

function parsePatchBody(body: unknown): { ok: true; value: QuoteLineItemPatch } | { ok: false; response: NextResponse } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_BODY", message: "Body must be an object" } }, { status: 400 }),
    };
  }
  const o = body as Record<string, unknown>;
  const patch: QuoteLineItemPatch = {};

  if ("title" in o) {
    if (typeof o.title !== "string") {
      return {
        ok: false,
        response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "title must be a string" } }, { status: 400 }),
      };
    }
    patch.title = o.title;
  }
  if ("description" in o) {
    if (o.description !== null && typeof o.description !== "string") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "description must be a string or null" } },
          { status: 400 },
        ),
      };
    }
    patch.description = o.description as string | null;
  }
  if ("quantity" in o) {
    if (typeof o.quantity !== "number" || !Number.isInteger(o.quantity)) {
      return {
        ok: false,
        response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "quantity must be an integer" } }, { status: 400 }),
      };
    }
    patch.quantity = o.quantity;
  }
  if ("sortOrder" in o) {
    if (typeof o.sortOrder !== "number" || !Number.isInteger(o.sortOrder)) {
      return {
        ok: false,
        response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "sortOrder must be an integer" } }, { status: 400 }),
      };
    }
    patch.sortOrder = o.sortOrder;
  }
  if ("tierCode" in o) {
    if (o.tierCode !== null && typeof o.tierCode !== "string") {
      return {
        ok: false,
        response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "tierCode must be a string or null" } }, { status: 400 }),
      };
    }
    patch.tierCode = o.tierCode as string | null;
  }
  if ("executionMode" in o) {
    if (typeof o.executionMode !== "string" || !EXECUTION_MODES.has(o.executionMode)) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "executionMode must be SOLD_SCOPE or MANIFEST" } },
          { status: 400 },
        ),
      };
    }
    patch.executionMode = o.executionMode as QuoteLineItemExecutionMode;
  }
  if ("scopePacketRevisionId" in o) {
    if (o.scopePacketRevisionId !== null && typeof o.scopePacketRevisionId !== "string") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "scopePacketRevisionId must be a string or null" } },
          { status: 400 },
        ),
      };
    }
    patch.scopePacketRevisionId = o.scopePacketRevisionId as string | null;
  }
  if ("quoteLocalPacketId" in o) {
    if (o.quoteLocalPacketId !== null && typeof o.quoteLocalPacketId !== "string") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "quoteLocalPacketId must be a string or null" } },
          { status: 400 },
        ),
      };
    }
    patch.quoteLocalPacketId = o.quoteLocalPacketId as string | null;
  }
  if ("unitPriceCents" in o) {
    if (o.unitPriceCents !== null && (typeof o.unitPriceCents !== "number" || !Number.isInteger(o.unitPriceCents))) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "unitPriceCents must be an integer or null" } },
          { status: 400 },
        ),
      };
    }
    patch.unitPriceCents = o.unitPriceCents as number | null;
  }
  if ("lineTotalCents" in o) {
    if (o.lineTotalCents !== null && (typeof o.lineTotalCents !== "number" || !Number.isInteger(o.lineTotalCents))) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "lineTotalCents must be an integer or null" } },
          { status: 400 },
        ),
      };
    }
    patch.lineTotalCents = o.lineTotalCents as number | null;
  }
  if ("proposalGroupId" in o) {
    if (typeof o.proposalGroupId !== "string" || !o.proposalGroupId.trim()) {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "proposalGroupId must be a non-empty string" } },
          { status: 400 },
        ),
      };
    }
    patch.proposalGroupId = o.proposalGroupId.trim();
  }
  if ("paymentBeforeWork" in o) {
    if (typeof o.paymentBeforeWork !== "boolean") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "paymentBeforeWork must be a boolean" } },
          { status: 400 },
        ),
      };
    }
    patch.paymentBeforeWork = o.paymentBeforeWork;
  }
  if ("paymentGateTitleOverride" in o) {
    if (o.paymentGateTitleOverride !== null && typeof o.paymentGateTitleOverride !== "string") {
      return {
        ok: false,
        response: NextResponse.json(
          { error: { code: "INVALID_FIELD", message: "paymentGateTitleOverride must be a string or null" } },
          { status: 400 },
        ),
      };
    }
    patch.paymentGateTitleOverride = o.paymentGateTitleOverride as string | null;
  }

  return { ok: true, value: patch };
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId, lineItemId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON" } }, { status: 400 });
  }

  const parsed = parsePatchBody(body);
  if (!parsed.ok) return parsed.response;

  if (Object.keys(parsed.value).length === 0) {
    return NextResponse.json({ error: { code: "EMPTY_PATCH", message: "At least one field is required" } }, { status: 400 });
  }

  try {
    const result = await updateQuoteLineItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      lineItemId,
      patch: parsed.value,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Line item, version, proposal group, or tenant scope not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId, lineItemId } = await context.params;

  try {
    const result = await deleteQuoteLineItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      lineItemId,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Line item or draft version not found for tenant" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: { deleted: true, id: lineItemId }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
