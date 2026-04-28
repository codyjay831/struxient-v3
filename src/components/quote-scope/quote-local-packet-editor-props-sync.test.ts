import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const editorPath = path.join(
  process.cwd(),
  "src",
  "components",
  "quote-scope",
  "quote-local-packet-editor.tsx",
);

/**
 * Regression: `QuoteLocalPacketEditor` must not keep only the first-mount
 * `initialPackets` in local state after `router.refresh()` delivers new RSC props
 * (e.g. field work attached from the line-item form).
 */
describe("QuoteLocalPacketEditor initialPackets → packets sync", () => {
  it("documents RSC refresh sync in source (no stale-only mount state)", () => {
    const source = readFileSync(editorPath, "utf8");
    expect(source).toContain("setPackets(initialPackets);");
    expect(source).toMatch(/,\s*\[\s*initialPackets\s*\]\s*\)\s*;/);
    expect(source).toMatch(/stay frozen at first mount/s);
  });
});
