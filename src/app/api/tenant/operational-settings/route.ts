import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPrisma } from "@/server/db/prisma";
import { jsonResponseForCaughtError } from "@/lib/api/tenant-json";
import { apiAuthMeta, requireApiPrincipalWithCapability } from "@/lib/auth/api-principal";
import { updateTenantOperationalSettingsForTenant } from "@/server/slice1/mutations/tenant-operational-settings-mutations";
import { getTenantOperationalSettingsForTenant } from "@/server/slice1/reads/tenant-operational-settings-reads";

/** Epic 60 / 59 — read tenant operational policy (office admin only; avoids leaking policy to read-only via API). */
export async function GET() {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  try {
    const settings = await getTenantOperationalSettingsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
    });
    if (!settings) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Tenant not found." } }, { status: 404 });
    }
    return NextResponse.json({ data: { settings }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}

/** Epic 60 — update operational policy (`office_mutate` / office admin only). */
export async function PATCH(request: NextRequest) {
  const authGate = await requireApiPrincipalWithCapability("office_mutate");
  if (!authGate.ok) return authGate.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: { code: "INVALID_JSON", message: "Body must be JSON." } }, { status: 400 });
  }
  const o = body !== null && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const max = o.customerDocumentMaxBytes;
  if (typeof max !== "number") {
    return NextResponse.json(
      { error: { code: "INVALID_BODY", message: "customerDocumentMaxBytes (integer) is required." } },
      { status: 400 },
    );
  }

  try {
    const result = await updateTenantOperationalSettingsForTenant(getPrisma(), {
      tenantId: authGate.principal.tenantId,
      actorUserId: authGate.principal.userId,
      input: { customerDocumentMaxBytes: max },
    });

    if (!result.ok) {
      if (result.kind === "tenant_not_found") {
        return NextResponse.json({ error: { code: "NOT_FOUND", message: "Tenant not found." } }, { status: 404 });
      }
      if (result.kind === "invalid_actor") {
        return NextResponse.json({ error: { code: "INVALID_ACTOR", message: "Actor not valid." } }, { status: 403 });
      }
      return NextResponse.json(
        {
          error: {
            code: "INVALID_CUSTOMER_DOCUMENT_MAX_BYTES",
            message: "Value must be an integer between tenant min and platform ceiling (see GET for limits).",
          },
        },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: { settings: result.settings }, meta: apiAuthMeta(authGate.principal) });
  } catch (e) {
    const json = jsonResponseForCaughtError(e);
    if (json) return json;
    throw e;
  }
}
