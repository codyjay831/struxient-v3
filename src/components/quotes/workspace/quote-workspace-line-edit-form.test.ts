import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-line-edit-form.tsx"), "utf8");

describe("quote-workspace-line-edit-form (static)", () => {
  it("patches line-items with title, description, quantity, lineTotalCents", () => {
    expect(src).toContain("/line-items/");
    expect(src).toContain('method: "PATCH"');
    expect(src).toContain("lineTotalCents");
    expect(src).toContain("validateWorkspaceLineEditFields");
  });

  it("shows unit price, read-only line total, and help copy", () => {
    expect(src).toContain("Unit price");
    expect(src).toContain("Line total");
    expect(src).toContain("No amount set");
    expect(src).toContain("Crew tasks and saved work stay managed from Line &amp; tasks");
  });

  it("does not add forbidden internal vocabulary to primary copy", () => {
    expect(src).not.toMatch(/\bMANIFEST\b/i);
    expect(src).not.toMatch(/\bSOLD_SCOPE\b/);
    expect(src).not.toMatch(/\bpacket\b/i);
  });
});
