import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export type SmokeFixture = {
  basePassword: string;
  tenantAId: string;
  tenantBId: string;
  quoteVersionId: string;
  proposalGroupId: string;
  /** Present after `npm run db:seed` with current seed — used by full-chain lifecycle smoke. */
  seedPublishedWorkflowVersionId?: string;
  seedPublishedScopePacketRevisionId?: string;
  emails: {
    office: string;
    readOnly: string;
    field: string;
    tenantBOffice: string;
  };
};

export function loadSmokeFixture(): SmokeFixture {
  const filePath = path.join(process.cwd(), "scripts", "integration", "fixture.json");
  if (!existsSync(filePath)) {
    throw new Error(
      `Missing ${filePath}. Run: npm run db:seed (writes fixture.json). Ensure Postgres and DATABASE_URL are set.`,
    );
  }
  return JSON.parse(readFileSync(filePath, "utf8")) as SmokeFixture;
}

function cookieHeaderFromSetCookie(setCookie: string[]): string {
  const pairs: string[] = [];
  for (const line of setCookie) {
    const idx = line.indexOf(";");
    pairs.push(idx >= 0 ? line.slice(0, idx).trim() : line.trim());
  }
  return pairs.filter(Boolean).join("; ");
}

/**
 * Real Auth.js credentials flow: CSRF GET + POST callback/credentials; returns Cookie header value for subsequent API calls.
 */
export async function signInCredentialsSession(
  baseUrl: string,
  tenantId: string,
  email: string,
  password: string,
): Promise<string> {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`GET /api/auth/csrf failed: ${csrfRes.status}`);
  }
  const csrfJson = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfJson.csrfToken) {
    throw new Error("CSRF response missing csrfToken");
  }

  const body = new URLSearchParams({
    csrfToken: csrfJson.csrfToken,
    callbackUrl: `${baseUrl.replace(/\/$/, "")}/`,
    email,
    password,
    tenantId,
  });

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Auth-Return-Redirect": "1",
    },
    body,
    redirect: "manual",
  });

  const setCookie =
    typeof res.headers.getSetCookie === "function"
      ? res.headers.getSetCookie()
      : parseFallbackSetCookie(res.headers.get("set-cookie"));

  if (setCookie.length === 0) {
    const text = await res.text();
    throw new Error(`Credentials sign-in did not set cookies (status ${res.status}): ${text.slice(0, 400)}`);
  }

  return cookieHeaderFromSetCookie(setCookie);
}

/** Older fetch implementations may expose a single Set-Cookie header. */
function parseFallbackSetCookie(header: string | null): string[] {
  if (!header) {
    return [];
  }
  return header.split(/,(?=[^;]+?=)/).map((s) => s.trim());
}

export function integrationBaseUrl(): string {
  return (process.env.INTEGRATION_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
}
