import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-line-item-list.tsx"), "utf8");

describe("quote-workspace-line-item-list copy (static)", () => {
  it("empty state points to full builder and Line & tasks without implying scope is the only path", () => {
    expect(src).toContain("+ Add line item");
    expect(src).toContain("Line & tasks →");
    expect(src).not.toMatch(/saved packets/i);
  });

  it("read-only footer references step 1 builder and Line & tasks", () => {
    expect(src).toContain("Read-only summary");
    expect(src).toContain("full builder");
  });
});
