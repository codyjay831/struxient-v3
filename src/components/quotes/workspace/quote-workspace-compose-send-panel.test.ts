import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-compose-send-panel.tsx"), "utf8");

describe("quote-workspace-compose-send-panel (compose preview wiring)", () => {
  it("types compose preview data with lineItemId-capable errors", () => {
    expect(src).toContain("ComposePreviewClientData");
    expect(src).toContain("lineItemId");
  });

  it("syncs preview to workspace context when provider is connected", () => {
    expect(src).toContain("useQuoteWorkspaceComposePreview");
    expect(src).toContain("composeConnected");
    expect(src).toContain("setCtxLastCompose");
  });

  it("keeps InternalActionResult for step 3 blocker summary", () => {
    expect(src).toContain("InternalActionResult");
    expect(src).toContain("Preview found blocking errors");
  });

  it("links to step 1 line items when preview errors reference a line", () => {
    expect(src).toContain('#line-items');
    expect(src).toContain("Jump to line items in step 1");
  });
});
