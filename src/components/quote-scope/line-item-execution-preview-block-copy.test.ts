import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "line-item-execution-preview-block.tsx"),
  "utf8",
);

describe("line-item-execution-preview-block copy (static)", () => {
  it("does not surface noisy empty-requirement or source-badge copy in the default path", () => {
    expect(source).not.toMatch(/no authored completion/i);
    expect(source).not.toMatch(/\bEmbedded\b/);
    expect(source).not.toMatch(/TaskDef/i);
  });

  it("keeps catalog identifiers inside a disclosure, not in the main header line", () => {
    expect(source).toContain("Catalog reference");
    expect(source).toContain("packetKey:");
    expect(source).toContain("<details");
  });

  it("keeps explicit empty-task guidance for operators", () => {
    expect(source).toMatch(/No tasks yet/i);
  });
});
