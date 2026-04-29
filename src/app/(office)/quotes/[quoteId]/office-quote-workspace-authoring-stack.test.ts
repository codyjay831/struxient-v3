import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const pageSrc = readFileSync(path.join(root, "page.tsx"), "utf8");
const scopePageSrc = readFileSync(path.join(root, "scope", "page.tsx"), "utf8");

describe("office quote workspace embedded authoring stack", () => {
  it("embedded branch mounts ScopeEditor via QuoteWorkspaceEmbeddedScopeEditor, not QuoteWorkspaceSimpleBuilder", () => {
    expect(pageSrc).toContain("QuoteWorkspaceEmbeddedScopeEditor");
    expect(pageSrc).toContain("groupedLineItems={officeAuthoring.grouping.groupsWithItems}");
    expect(pageSrc).not.toContain("QuoteWorkspaceSimpleBuilder");
  });

  it("embedded branch demotes QuoteLocalPacketEditor to unattached packets only (not full primary list)", () => {
    expect(pageSrc).toContain("<QuoteLocalPacketEditor");
    expect(pageSrc).toContain("initialPackets={unattachedQuoteLocalPackets}");
    expect(pageSrc).not.toContain("initialPackets={officeAuthoring.localPackets}");
    expect(pageSrc).toContain("lineItemTitlesByLocalPacketId={lineItemTitlesByLocalPacketId}");
    expect(pageSrc).toContain("availableSavedPackets={librarySavedPacketOptions}");
  });

  it("does not pass fieldWorkExternalBaseHref to ScopeEditor on the quote workspace page", () => {
    expect(pageSrc).not.toMatch(/fieldWorkExternalBaseHref/);
  });

  it("step 1 copy says quote can be built in the workspace without requiring /scope for normal work", () => {
    expect(pageSrc).toContain("without leaving the workspace");
    expect(pageSrc).toContain('hint="Build the quote here. Add line items, saved work, and crew tasks without leaving the workspace."');
  });

  it("optional focused scope link label is not the primary workflow", () => {
    expect(pageSrc).toContain("Focused Line &amp; tasks view");
  });

  it("standalone scope route still mounts ScopeEditor as focused view", () => {
    expect(scopePageSrc).toContain("<ScopeEditor");
    expect(scopePageSrc).toContain("<QuoteLocalPacketEditor");
  });
});
