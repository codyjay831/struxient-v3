import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-line-card.tsx"), "utf8");

describe("quote-workspace-line-card compose blocker (static)", () => {
  it("accepts optional composeBlocker and renders banner + technical disclosure", () => {
    expect(src).toContain("composeBlocker");
    expect(src).toContain("contractorTitle");
    expect(src).toContain("Technical details");
    expect(src).toContain("technicalCode");
    expect(src).toContain("additionalTechnical");
  });

  it("anchors line cards for workspace / scope deep links", () => {
    expect(src).toContain('id={`line-item-${line.id}`}');
  });
});

describe("quote-workspace-line-card estimate-only crew handoff (static)", () => {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
  const src = readFileSync(path.join(root, "quote-workspace-line-card.tsx"), "utf8");

  it("shows Add crew tasks handoff only when estimate-only, editable, not editing, and no compose blocker", () => {
    expect(src).toContain("showEstimateOnlyCrewHandoff");
    expect(src).toContain("!createsCrew && canAuthorTasks && !editingLine && !composeBlocker");
  });

  it("uses same-page quote workspace anchor for the handoff link", () => {
    expect(src).toContain('`/quotes/${quoteId}#line-item-${line.id}`');
    expect(src).toContain("Set up crew tasks on this line");
  });

  it("includes helper and safety copy for contractors", () => {
    expect(src).toContain("Add crew tasks");
    expect(src).toContain("Use this when this line should include internal crew work after the quote is approved.");
    expect(src).toContain("This line stays estimate-only until crew tasks or saved work are added.");
  });

  it("does not add forbidden internal vocabulary to new handoff copy", () => {
    const handoffRegion = src.slice(src.indexOf("showEstimateOnlyCrewHandoff"));
    expect(handoffRegion).not.toMatch(/\bMANIFEST\b/i);
    expect(handoffRegion).not.toMatch(/\bSOLD_SCOPE\b/);
    expect(handoffRegion).not.toMatch(/\bpacket\b/i);
    expect(handoffRegion).not.toMatch(/targetNodeKey/);
    expect(handoffRegion).not.toMatch(/tier filter/i);
  });
});
