import { NextResponse } from "next/server";
import type { TenantMemberRole } from "@prisma/client";
import { auth } from "@/auth";
import { getPrisma } from "@/server/db/prisma";

export type ApiPrincipal = {
  userId: string;
  tenantId: string;
  role: TenantMemberRole;
  authSource: "session" | "dev_bypass";
};

export function apiAuthMeta(principal: ApiPrincipal) {
  return { auth: { source: principal.authSource } };
}

export type ApiCapability = "read" | "office_mutate" | "field_execute";

export type ResolvePrincipalFailure =
  | { kind: "unauthenticated" }
  | { kind: "bypass_misconfigured" }
  | { kind: "bypass_invalid_user" };

function isDevAuthBypassEnabled(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.STRUXIENT_DEV_AUTH_BYPASS === "true";
}

export function principalHasCapability(principal: ApiPrincipal, capability: ApiCapability): boolean {
  switch (capability) {
    case "read":
      return true;
    case "field_execute":
      return principal.role === "OFFICE_ADMIN" || principal.role === "FIELD_WORKER";
    case "office_mutate":
      return principal.role === "OFFICE_ADMIN";
    default:
      return false;
  }
}

/**
 * Resolves the caller for protected API routes and server components: JWT session first,
 * or dev-only bypass when STRUXIENT_DEV_AUTH_BYPASS=true (non-production only) with env user/tenant verified in DB.
 */
export async function tryGetApiPrincipal(): Promise<
  { ok: true; principal: ApiPrincipal } | { ok: false; failure: ResolvePrincipalFailure }
> {
  if (isDevAuthBypassEnabled()) {
    const tenantId = process.env.STRUXIENT_DEV_TENANT_ID?.trim();
    const userId = process.env.STRUXIENT_DEV_USER_ID?.trim();
    if (!tenantId || !userId) {
      return { ok: false, failure: { kind: "bypass_misconfigured" } };
    }
    const prisma = getPrisma();
    const user = await prisma.user.findFirst({
      where: { id: userId, tenantId },
      select: { id: true, tenantId: true, role: true },
    });
    if (!user) {
      return { ok: false, failure: { kind: "bypass_invalid_user" } };
    }
    return {
      ok: true,
      principal: {
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        authSource: "dev_bypass",
      },
    };
  }

  const session = await auth();
  if (!session?.user?.id || !session.user.tenantId || !session.user.role) {
    return { ok: false, failure: { kind: "unauthenticated" } };
  }

  return {
    ok: true,
    principal: {
      userId: session.user.id,
      tenantId: session.user.tenantId,
      role: session.user.role,
      authSource: "session",
    },
  };
}

function failureToResponse(failure: ResolvePrincipalFailure): NextResponse {
  switch (failure.kind) {
    case "unauthenticated":
      return NextResponse.json(
        {
          error: {
            code: "AUTHENTICATION_REQUIRED",
            message:
              "Sign in with credentials (see /dev/login) or, in local non-production only, set STRUXIENT_DEV_AUTH_BYPASS=true with STRUXIENT_DEV_TENANT_ID and STRUXIENT_DEV_USER_ID from seed.",
          },
        },
        { status: 401 },
      );
    case "bypass_misconfigured":
      return NextResponse.json(
        {
          error: {
            code: "DEV_AUTH_BYPASS_MISCONFIGURED",
            message:
              "STRUXIENT_DEV_AUTH_BYPASS is enabled but STRUXIENT_DEV_TENANT_ID or STRUXIENT_DEV_USER_ID is missing.",
          },
        },
        { status: 500 },
      );
    case "bypass_invalid_user":
      return NextResponse.json(
        {
          error: {
            code: "DEV_AUTH_BYPASS_INVALID_USER",
            message: "Dev auth bypass: user id is not a member of the configured tenant.",
          },
        },
        { status: 403 },
      );
    default:
      return NextResponse.json({ error: { code: "AUTH_ERROR", message: "Authentication failed." } }, { status: 401 });
  }
}

export async function requireApiPrincipal(): Promise<
  { ok: true; principal: ApiPrincipal } | { ok: false; response: NextResponse }
> {
  const r = await tryGetApiPrincipal();
  if (!r.ok) {
    return { ok: false, response: failureToResponse(r.failure) };
  }
  return { ok: true, principal: r.principal };
}

export async function requireApiPrincipalWithCapability(
  capability: ApiCapability,
): Promise<{ ok: true; principal: ApiPrincipal } | { ok: false; response: NextResponse }> {
  const gate = await requireApiPrincipal();
  if (!gate.ok) {
    return gate;
  }
  if (!principalHasCapability(gate.principal, capability)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "INSUFFICIENT_ROLE",
            message: "Your role cannot perform this operation.",
          },
        },
        { status: 403 },
      ),
    };
  }
  return gate;
}
