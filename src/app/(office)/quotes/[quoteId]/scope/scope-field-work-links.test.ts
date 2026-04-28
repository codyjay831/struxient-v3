import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scopeEditor = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "scope-editor.tsx"),
  "utf8",
);
const packetEditor = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "..",
    "..",
    "..",
    "components",
    "quote-scope",
    "quote-local-packet-editor.tsx",
  ),
  "utf8",
);

describe("line item → field work links (static)", () => {
  it("PacketRow exposes stable field-work anchor id", () => {
    expect(packetEditor).toMatch(/id=\{`field-work-\$\{packet\.id\}`\}/);
  });

  it("library branch does not link to quote-local field-work anchors", () => {
    const start = scopeEditor.indexOf("function LineItemFieldWorkActions");
    const end = scopeEditor.indexOf("function LineItemForm");
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    const actionsFn = scopeEditor.slice(start, end);
    const libBranchMatch = actionsFn.match(
      /if \(kind === "manifestLibrary"\) \{[\s\S]*?\n  \}\n\n  if \(item\.scopePacketRevisionId/,
    );
    expect(libBranchMatch?.[0]).toBeDefined();
    expect(libBranchMatch![0]).not.toContain("#field-work-");
  });

  it("shows Edit tasks and Add tasks labels for local field work", () => {
    expect(scopeEditor).toContain("Edit tasks");
    expect(scopeEditor).toContain("Add tasks");
    expect(scopeEditor).toContain("Review tasks");
    expect(scopeEditor).toContain("Open saved packet");
    expect(scopeEditor).toContain("Set up field work");
  });

  it("single default Main group uses muted header branch", () => {
    expect(scopeEditor).toContain("singleDefaultMainGroup");
    expect(scopeEditor).toContain('proposalGroups[0]?.name?.trim() === "Main"');
  });
});
