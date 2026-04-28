import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { QuoteLineItemExecutionMode } from "@prisma/client";
import { getPrisma } from "@/server/db/prisma";
import { createQuoteLineItemForTenant } from "@/server/slice1/mutations/quote-line-item-mutations";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";

type RouteContext = { params: Promise<{ quoteVersionId: string }> };

const EXECUTION_MODES = new Set<string>(["SOLD_SCOPE", "MANIFEST"]);

type CreateLineBodyFields = Omit<
  Parameters<typeof createQuoteLineItemForTenant>[1],
  "tenantId" | "quoteVersionId"
>;

function parseCreateBody(body: unknown): { ok: true; value: CreateLineBodyFields } | { ok: false; response: NextResponse } {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_BODY", message: "Body must be an object" } }, { status: 400 }),
    };
  }
  const o = body as Record<string, unknown>;

  const proposalGroupId = o.proposalGroupId;
  if (typeof proposalGroupId !== "string" || !proposalGroupId.trim()) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "proposalGroupId must be a non-empty string" } }, { status: 400 }),
    };
  }

  const sortOrder = o.sortOrder;
  if (typeof sortOrder !== "number" || !Number.isInteger(sortOrder)) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "sortOrder must be an integer" } }, { status: 400 }),
    };
  }

  const executionMode = o.executionMode;
  if (typeof executionMode !== "string" || !EXECUTION_MODES.has(executionMode)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "executionMode must be SOLD_SCOPE or MANIFEST" } },
        { status: 400 },
      ),
    };
  }

  const title = o.title;
  if (typeof title !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "title must be a string" } }, { status: 400 }),
    };
  }
  const titleTrimmed = title.trim();
  if (titleTrimmed.length === 0) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "Line title is required (non-empty after trim)." } },
        { status: 400 },
      ),
    };
  }

  const quantity = o.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "quantity must be an integer" } }, { status: 400 }),
    };
  }

  const description = o.description;
  if (description !== undefined && description !== null && typeof description !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "description must be a string or null" } }, { status: 400 }),
    };
  }

  const tierCode = o.tierCode;
  if (tierCode !== undefined && tierCode !== null && typeof tierCode !== "string") {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "tierCode must be a string or null" } }, { status: 400 }),
    };
  }

  const scopePacketRevisionId = o.scopePacketRevisionId;
  if (scopePacketRevisionId !== undefined && scopePacketRevisionId !== null && typeof scopePacketRevisionId !== "string") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "scopePacketRevisionId must be a string or null" } },
        { status: 400 },
      ),
    };
  }

  const quoteLocalPacketId = o.quoteLocalPacketId;
  if (quoteLocalPacketId !== undefined && quoteLocalPacketId !== null && typeof quoteLocalPacketId !== "string") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "quoteLocalPacketId must be a string or null" } },
        { status: 400 },
      ),
    };
  }

  const unitPriceCents = o.unitPriceCents;
  if (unitPriceCents !== undefined && unitPriceCents !== null && (typeof unitPriceCents !== "number" || !Number.isInteger(unitPriceCents))) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "unitPriceCents must be an integer or null" } }, { status: 400 }),
    };
  }

  const lineTotalCents = o.lineTotalCents;
  if (lineTotalCents !== undefined && lineTotalCents !== null && (typeof lineTotalCents !== "number" || !Number.isInteger(lineTotalCents))) {
    return {
      ok: false,
      response: NextResponse.json({ error: { code: "INVALID_FIELD", message: "lineTotalCents must be an integer or null" } }, { status: 400 }),
    };
  }

  const paymentBeforeWork = o.paymentBeforeWork;
  if (paymentBeforeWork !== undefined && typeof paymentBeforeWork !== "boolean") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "paymentBeforeWork must be a boolean when provided" } },
        { status: 400 },
      ),
    };
  }

  const paymentGateTitleOverride = o.paymentGateTitleOverride;
  if (
    paymentGateTitleOverride !== undefined &&
    paymentGateTitleOverride !== null &&
    typeof paymentGateTitleOverride !== "string"
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "INVALID_FIELD", message: "paymentGateTitleOverride must be a string or null" } },
        { status: 400 },
      ),
    };
  }

  return {
    ok: true,
    value: {
      proposalGroupId: proposalGroupId.trim(),
      sortOrder,
      executionMode: executionMode as QuoteLineItemExecutionMode,
      title: titleTrimmed,
      description: description === undefined ? null : (description as string | null),
      quantity,
      tierCode: tierCode === undefined ? null : (tierCode as string | null),
      scopePacketRevisionId: scopePacketRevisionId === undefined ? null : (scopePacketRevisionId as string | null),
      quoteLocalPacketId: quoteLocalPacketId === undefined ? null : (quoteLocalPacketId as string | null),
      unitPriceCents: unitPriceCents === undefined ? null : (unitPriceCents as number | null),
      lineTotalCents: lineTotalCents === undefined ? null : (lineTotalCents as number | null),
      paymentBeforeWork: paymentBeforeWork === true,
      paymentGateTitleOverride:
        paymentGateTitleOverride === undefined
          ? null
          : (paymentGateTitleOverride as string | null),
    },
  };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  const { quoteVersionId } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Request body must be JSON" } }, { status: 400 });
  }

  const parsed = parseCreateBody(body);
  if (!parsed.ok) return parsed.response;

  try {
    const result = await createQuoteLineItemForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      quoteVersionId,
      ...parsed.value,
    });

    if (result === "not_found") {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Quote version, proposal group, or tenant scope not found" } },
        { status: 404 },
      );
    }

    return NextResponse.json({ data: result, meta: apiAuthMeta(authGate.principal) }, { status: 201 });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
