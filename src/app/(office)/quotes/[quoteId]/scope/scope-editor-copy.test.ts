import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static copy guard for the scope line-item field-work UX (Triangle Mode).
 * Ensures the investigated overpromise string does not return without a deliberate edit.
 */
const scopeEditorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "scope-editor.tsx"),
  "utf8",
);

describe("scope-editor field-work copy (static)", () => {
  it("uses honest editable-field-work label, not create-new-tasks overpromise", () => {
    expect(scopeEditorSource).not.toContain("Create new tasks for this line");
    expect(scopeEditorSource).toContain("Create editable field work for this line");
  });

  it("uses one-click create field work for this line without requiring a second name step", () => {
    expect(scopeEditorSource).toContain("Create field work for this line");
    expect(scopeEditorSource).toContain("Add a line title before creating field work.");
    expect(scopeEditorSource).toContain("Customize name before creating");
    expect(scopeEditorSource).toContain("Uses your line title as the field work name.");
  });

  it("surfaces add-tasks-below handoff link label", () => {
    expect(scopeEditorSource).toContain("Add tasks below →");
  });

  it("does not leak one-off into visible strings (allow comments mentioning quote-local API)", () => {
    expect(scopeEditorSource).not.toMatch(/>\s*[^<]*one-off[^<]*</i);
  });

  it("exposes field-work status chip labels for line item scan", () => {
    expect(scopeEditorSource).toContain("Quote only");
    expect(scopeEditorSource).toContain("Field work attached");
    expect(scopeEditorSource).toContain("Needs field work");
    expect(scopeEditorSource).toContain("Field work has no tasks");
  });

  it("does not put packetKey in the primary saved-packet summary string", () => {
    expect(scopeEditorSource).toContain("Saved task packet ·");
    expect(scopeEditorSource).not.toMatch(/\$\{parent\.displayName\} \(\$\{parent\.packetKey\}\)/);
  });

  it("puts create-new field work ahead of the reuse dropdown in the create branch", () => {
    expect(scopeEditorSource).not.toContain("— Choose field work on this quote —");
    expect(scopeEditorSource).toContain("Choose existing field work on this quote…");
    expect(scopeEditorSource).toContain("Use existing field work instead");
    const anchor = '      {manifestFieldWorkSetup === "createNewTasks" ? (';
    const branchStart = scopeEditorSource.indexOf(anchor);
    expect(branchStart).toBeGreaterThanOrEqual(0);
    const branchEnd = scopeEditorSource.indexOf(
      '      {manifestFieldWorkSetup === "startFromSavedAndCustomize" ? (',
      branchStart + 1,
    );
    expect(branchEnd).toBeGreaterThan(branchStart);
    const createBranchSlice = scopeEditorSource.slice(branchStart, branchEnd);
    expect(createBranchSlice.indexOf("InlineCreateTaskPacketForLine")).toBeLessThan(
      createBranchSlice.indexOf("Choose existing field work on this quote…"),
    );
  });
});
