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

describe("quote-local-packet-editor UX copy", () => {
  const source = readFileSync(editorPath, "utf8");

  it("uses task-oriented empty state and primary CTA", () => {
    expect(source).toContain("No tasks yet.");
    expect(source).toContain("Add the first crew task for this custom work.");
    expect(source).toContain("Add first task");
  });

  it("uses custom work group count label", () => {
    expect(source).toContain("custom work groups");
  });

  it("avoids legacy packet-item labels in default flow", () => {
    expect(source).not.toContain("No items on this packet yet.");
    expect(source).not.toContain("Embedded title");
    expect(source).not.toContain("Line kind");
    expect(source).not.toContain(">Line key<");
    expect(source).not.toContain("Sort order");
  });

  it("exposes library path as secondary", () => {
    expect(source).toContain("Add from task library");
  });

  it("keeps default section title for focused scope / quote-level mounts", () => {
    expect(source).toContain("Custom work on this quote");
  });

  it("uses shared-by wording for inline multi-line used-by labels", () => {
    expect(source).toContain("Shared by ${titles.length} lines");
    expect(source).toContain("Used by this line");
  });

  it("uses Technical details disclosure for inline editor, not Advanced packet wording", () => {
    expect(source).toContain("Technical details");
    expect(source).not.toContain("Advanced — library templates and packet IDs");
  });
});
