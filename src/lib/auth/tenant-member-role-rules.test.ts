import { describe, it, expect } from "vitest";
import { wouldDemoteLastOfficeAdmin } from "./tenant-member-role-rules";

describe("wouldDemoteLastOfficeAdmin", () => {
  it("blocks demoting the only office admin", () => {
    expect(wouldDemoteLastOfficeAdmin(1, "OFFICE_ADMIN", "READ_ONLY")).toBe(true);
    expect(wouldDemoteLastOfficeAdmin(1, "OFFICE_ADMIN", "FIELD_WORKER")).toBe(true);
  });

  it("allows demoting one admin when another admin exists", () => {
    expect(wouldDemoteLastOfficeAdmin(2, "OFFICE_ADMIN", "FIELD_WORKER")).toBe(false);
  });

  it("allows non-demotions", () => {
    expect(wouldDemoteLastOfficeAdmin(1, "FIELD_WORKER", "OFFICE_ADMIN")).toBe(false);
    expect(wouldDemoteLastOfficeAdmin(1, "READ_ONLY", "OFFICE_ADMIN")).toBe(false);
  });
});
