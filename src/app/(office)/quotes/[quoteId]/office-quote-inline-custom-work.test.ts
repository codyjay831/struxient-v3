import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const pageSrc = readFileSync(path.join(root, "page.tsx"), "utf8");

describe("office quote workspace line-owned custom work (static)", () => {
  it("threads line-owned ScopeEditor props on the embedded authoring stack", () => {
    expect(pageSrc).toContain("lineOwnedCustomWork");
    expect(pageSrc).toContain("inlineLocalTaskEditing");
    expect(pageSrc).toContain("workspaceCrewTaskCopy");
    expect(pageSrc).toContain("availableSavedPacketsForFieldWork={librarySavedPacketOptions}");
    expect(pageSrc).toContain("pinnedWorkflowVersionId={officeAuthoring.dto.quoteVersion.pinnedWorkflowVersionId}");
  });

  it("does not mount a primary full-list QuoteLocalPacketEditor section like the focused scope page", () => {
    expect(pageSrc).not.toContain("initialPackets={officeAuthoring.localPackets}");
  });

  it("demotes unattached local packets into a collapsed details region", () => {
    expect(pageSrc).toContain("unattachedQuoteLocalPackets");
    expect(pageSrc).toContain("Unattached custom work");
    expect(pageSrc).toContain('sectionDomId="quote-local-field-work-unattached"');
  });

  it("does not use the default quote-level custom work heading string on the workspace page source", () => {
    expect(pageSrc).not.toContain("Custom work on this quote");
  });
});
