import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-crew-tasks-section.tsx"), "utf8");

describe("quote-workspace-crew-tasks-section (static wiring)", () => {
  it("uses PATCH and DELETE item routes for edit/delete", () => {
    expect(src).toContain('method: "PATCH"');
    expect(src).toContain('method: "DELETE"');
    expect(src).toMatch(/\/items\/\$\{encodeURIComponent\(itemId\)\}/);
  });

  it("confirms delete with the same prompt as packet editor", () => {
    expect(src).toContain('window.confirm("Delete this task?")');
  });

  it("uses EmbeddedTaskAuthoringForm edit + item helpers for embedded rows", () => {
    expect(src).toContain('variant="edit"');
    expect(src).toContain("itemToDraft");
    expect(src).toContain("lineKeysForPacketCollision");
    expect(src).toContain("draftToBody");
  });

  it("R4A: bootstraps crew list via version local-packets POST then line PATCH + item POST", () => {
    expect(src).toContain("/local-packets");
    expect(src).toContain('method: "POST"');
    expect(src).toContain("scopePacketRevisionId: null");
    expect(src).toContain("quoteLocalPacketId: newPacketId");
    expect(src).toContain("line-items");
  });
});
