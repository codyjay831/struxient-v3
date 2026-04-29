import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-simple-builder.tsx"), "utf8");

describe("quote-workspace-simple-builder (add line wiring)", () => {
  it("renders QuoteWorkspaceLineCreateForm with version and group data", () => {
    expect(src).toContain("QuoteWorkspaceLineCreateForm");
    expect(src).toContain("quoteVersionId={quoteVersionId}");
    expect(src).toContain("groupsWithItems={groupsWithItems}");
    expect(src).toContain("canAddLineItems={canAuthorTasks}");
    expect(src).toContain("useQuoteWorkspaceComposePreview");
    expect(src).toContain("composeBlocker={composeBlockerByLineId[line.id] ?? null}");
  });

  it("places create form before grouped line cards", () => {
    const idxForm = src.indexOf("QuoteWorkspaceLineCreateForm");
    const idxMap = src.indexOf("groupsWithItems.map");
    expect(idxForm).toBeGreaterThan(-1);
    expect(idxMap).toBeGreaterThan(-1);
    expect(idxForm).toBeLessThan(idxMap);
  });
});
