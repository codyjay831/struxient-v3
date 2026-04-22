import { headers } from "next/headers";

function firstSegment(value: string | null): string {
  if (!value) return "";
  return value.split(",")[0]?.trim() ?? "";
}

/**
 * Absolute origin for customer-facing links (portal URLs, email/SMS bodies).
 * Prefer `STRUXIENT_PUBLIC_APP_ORIGIN` or `NEXT_PUBLIC_APP_URL` when set; otherwise derive from proxy headers.
 */
export async function deriveAppOrigin(): Promise<string> {
  const fromEnv =
    process.env.STRUXIENT_PUBLIC_APP_ORIGIN?.trim() ?? process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv && /^https?:\/\//i.test(fromEnv)) {
    return fromEnv.replace(/\/$/, "");
  }

  const h = await headers();
  const host = firstSegment(h.get("x-forwarded-host")) || firstSegment(h.get("host"));
  const proto = firstSegment(h.get("x-forwarded-proto")) || (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) {
    return `${proto}://${host}`.replace(/\/$/, "");
  }

  return "http://127.0.0.1:3000";
}
