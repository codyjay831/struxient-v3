import { describe, expect, it } from "vitest";
import {
  OFFICE_SEARCH_QUERY_MAX_LEN,
  OFFICE_SEARCH_QUERY_MIN_LEN,
  OFFICE_SEARCH_SECTION_ORDER,
  normalizeOfficeSearchQuery,
} from "./office-tenant-search-reads";

describe("normalizeOfficeSearchQuery", () => {
  it("returns absent for null, undefined, and whitespace-only", () => {
    expect(normalizeOfficeSearchQuery(null)).toEqual({ ok: "absent" });
    expect(normalizeOfficeSearchQuery(undefined)).toEqual({ ok: "absent" });
    expect(normalizeOfficeSearchQuery("   ")).toEqual({ ok: "absent" });
  });

  it("refuses too short after trim", () => {
    expect(normalizeOfficeSearchQuery("a")).toEqual({ ok: false, refusal: "too_short" });
    expect(normalizeOfficeSearchQuery(" x")).toEqual({ ok: false, refusal: "too_short" });
  });

  it("accepts boundary length", () => {
    expect(normalizeOfficeSearchQuery("ab")).toEqual({ ok: true, needle: "ab" });
    const max = "x".repeat(OFFICE_SEARCH_QUERY_MAX_LEN);
    expect(normalizeOfficeSearchQuery(max)).toEqual({ ok: true, needle: max });
  });

  it("refuses over max length", () => {
    const over = "y".repeat(OFFICE_SEARCH_QUERY_MAX_LEN + 1);
    expect(normalizeOfficeSearchQuery(over)).toEqual({ ok: false, refusal: "too_long" });
  });

  it("trims leading and trailing whitespace on success", () => {
    expect(normalizeOfficeSearchQuery("  foo  ")).toEqual({ ok: true, needle: "foo" });
  });
});

describe("OFFICE_SEARCH_SECTION_ORDER", () => {
  it("lists customers before quotes before library", () => {
    const kinds = [...OFFICE_SEARCH_SECTION_ORDER];
    expect(kinds.indexOf("customers")).toBeLessThan(kinds.indexOf("quotes"));
    expect(kinds.indexOf("quotes")).toBeLessThan(kinds.indexOf("library_packets"));
  });
});
