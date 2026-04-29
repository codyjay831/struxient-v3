import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-line-item-list.tsx"), "utf8");

describe("quote-workspace-line-item-list copy (static)", () => {
  it("empty state offers optional focused view when full editor is unavailable", () => {
    expect(src).toContain("Focused Line & tasks view");
    expect(src).toContain("/scope");
    expect(src).not.toMatch(/saved packets/i);
  });

  it("read-only footer references step 1 and optional focused view", () => {
    expect(src).toContain("Read-only summary");
    expect(src).toContain("full editor");
  });
});
