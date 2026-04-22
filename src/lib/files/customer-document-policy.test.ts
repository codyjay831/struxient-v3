import { describe, it, expect } from "vitest";
import { CustomerDocumentCategory } from "@prisma/client";
import {
  effectiveCustomerDocumentMaxBytes,
  inferCustomerDocumentCategory,
  isAllowedOfficeCustomerDocumentContentType,
  MAX_CUSTOMER_DOCUMENT_BYTES,
  MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES,
  PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES,
  sanitizeCustomerDocumentDisplayName,
} from "./customer-document-policy";

describe("customer-document-policy", () => {
  it("allows common images and PDF", () => {
    expect(isAllowedOfficeCustomerDocumentContentType("image/png")).toBe(true);
    expect(isAllowedOfficeCustomerDocumentContentType("application/pdf")).toBe(true);
    expect(isAllowedOfficeCustomerDocumentContentType("APPLICATION/PDF")).toBe(true);
  });

  it("blocks arbitrary executables", () => {
    expect(isAllowedOfficeCustomerDocumentContentType("application/x-msdownload")).toBe(false);
    expect(isAllowedOfficeCustomerDocumentContentType("application/octet-stream")).toBe(false);
  });

  it("infers category from content type", () => {
    expect(inferCustomerDocumentCategory("image/jpeg")).toBe(CustomerDocumentCategory.IMAGE);
    expect(inferCustomerDocumentCategory("application/pdf")).toBe(CustomerDocumentCategory.DOCUMENT);
  });

  it("sanitizes path-like names", () => {
    expect(sanitizeCustomerDocumentDisplayName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeCustomerDocumentDisplayName("  ok.pdf  ")).toBe("ok.pdf");
  });

  it("documents max size constant", () => {
    expect(MAX_CUSTOMER_DOCUMENT_BYTES).toBe(20 * 1024 * 1024);
  });

  it("clamps tenant max to platform floor and ceiling", () => {
    expect(effectiveCustomerDocumentMaxBytes(100)).toBe(MIN_TENANT_CUSTOMER_DOCUMENT_MAX_BYTES);
    expect(effectiveCustomerDocumentMaxBytes(999_999_999)).toBe(PLATFORM_CUSTOMER_DOCUMENT_MAX_CEILING_BYTES);
    expect(effectiveCustomerDocumentMaxBytes(10 * 1024 * 1024)).toBe(10 * 1024 * 1024);
  });
});
