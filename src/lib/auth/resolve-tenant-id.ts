import type { NextRequest } from "next/server";

export type TenantResolution =
  | { ok: true; tenantId: string; source: "env" | "header" }
  | { ok: false; reason: "missing_tenant" | "header_forbidden_in_production" };

/**
 * Legacy tenant resolution for unauthenticated code paths only.
 * Protected API routes and dev server components use session + membership (`tryGetApiPrincipal`).
 *
 * 1) STRUXIENT_DEV_TENANT_ID (preferred for local tooling that has not been migrated)
 * 2) x-struxient-tenant-id header — allowed in non-production, or in production only if
 *    STRUXIENT_ALLOW_TENANT_HEADER=true (explicit escape hatch; do not enable in real deployments).
 */
export function resolveTenantIdForRequest(request: NextRequest): TenantResolution {
  const envTenant = process.env.STRUXIENT_DEV_TENANT_ID?.trim();
  if (envTenant) {
    return { ok: true, tenantId: envTenant, source: "env" };
  }

  const headerTenant = request.headers.get("x-struxient-tenant-id")?.trim();
  if (!headerTenant) {
    return { ok: false, reason: "missing_tenant" };
  }

  if (process.env.NODE_ENV === "production") {
    if (process.env.STRUXIENT_ALLOW_TENANT_HEADER === "true") {
      return { ok: true, tenantId: headerTenant, source: "header" };
    }
    return { ok: false, reason: "header_forbidden_in_production" };
  }

  return { ok: true, tenantId: headerTenant, source: "header" };
}

/**
 * Env-only tenant for legacy callers. Prefer `tryGetApiPrincipal` in Server Components.
 */
export function resolveTenantIdFromServerEnv(): TenantResolution {
  const envTenant = process.env.STRUXIENT_DEV_TENANT_ID?.trim();
  if (!envTenant) {
    return { ok: false, reason: "missing_tenant" };
  }
  return { ok: true, tenantId: envTenant, source: "env" };
}
