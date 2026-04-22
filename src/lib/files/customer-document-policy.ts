import { CustomerDocumentCategory } from "@prisma/client";

/** Product default when tenant row is missing or invalid (bytes). */
export const DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;

/** Legacy name — same as {@link DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES}. */
export const MAX_CUSTOMER_DOCUMENT_BYTES = DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES;

/** Platform ceiling: tenant admin cannot raise above this (bytes). */
export const PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES = 50 * 1024 * 1024;

/** Floor for tenant-configured max (bytes). */
export const MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES = 512 * 1024;

/**
 * Effective per-tenant max upload size after clamping stored `Tenant.customerDocumentMaxBytes`.
 */
export function effectiveCustomerDocumentMaxBytes(tenantStoredMaxBytes: number): number {
  const n = Number(tenantStoredMaxBytes);
  if (!Number.isFinite(n)) return DEFAULT_CUSTOMER_DOCUMENT_MAX_BYTES;
  return Math.min(
    PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
    Math.max(MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES, Math.floor(n)),
  );
}

const ALLOWED_EXACT = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

/**
 * Conservative allowlist for **office** customer documents (not arbitrary binaries).
 */
export function isAllowedOfficeCustomerDocumentContentType(raw: string): boolean {
  const ct = raw.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ct.startsWith("image/")) return true;
  return ALLOWED_EXACT.has(ct);
}

export function inferCustomerDocumentCategory(contentType: string): CustomerDocumentCategory {
  const ct = contentType.toLowerCase().split(";")[0]?.trim() ?? "";
  if (ct.startsWith("image/")) return CustomerDocumentCategory.IMAGE;
  if (ct === "application/pdf" || ALLOWED_EXACT.has(ct)) return CustomerDocumentCategory.DOCUMENT;
  return CustomerDocumentCategory.OTHER;
}

export function sanitizeCustomerDocumentDisplayName(original: string): string {
  const normalized = original.replace(/\\/g, "/");
  const base = normalized.split("/").pop()?.trim() || "file";
  const cleaned = base.replace(/[^\w.\- ()[\]]+/g, "_");
  return cleaned.length > 255 ? cleaned.slice(0, 255) : cleaned;
}
