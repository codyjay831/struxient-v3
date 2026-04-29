import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Static copy guard for the scope line-item work-setup UX (Triangle Mode).
 */
const scopeEditorSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "scope-editor.tsx"),
  "utf8",
);

describe("scope-editor work-setup copy (static)", () => {
  it("uses honest editable-custom-work label, not create-new-tasks overpromise", () => {
    expect(scopeEditorSource).not.toContain("Create new tasks for this line");
    expect(scopeEditorSource).toContain("Add custom work");
  });

  it("uses one-click add custom work without requiring a second name step", () => {
    expect(scopeEditorSource).toContain("Add custom work");
    expect(scopeEditorSource).toContain("Add a line title before creating custom work.");
    expect(scopeEditorSource).toContain("Customize name before creating");
    expect(scopeEditorSource).toContain("Uses your line title as the custom work name.");
  });

  it("surfaces add-crew-tasks-below handoff link label", () => {
    expect(scopeEditorSource).toContain("Add crew tasks below →");
  });

  it("does not leak one-off into visible strings (allow comments mentioning quote-local API)", () => {
    expect(scopeEditorSource).not.toMatch(/>\s*[^<]*one-off[^<]*</i);
  });

  it("exposes crew-work status chip labels for line item scan", () => {
    expect(scopeEditorSource).toContain("Estimate-only line");
    expect(scopeEditorSource).toContain("Includes crew work");
    expect(scopeEditorSource).toContain("Needs crew work setup");
    expect(scopeEditorSource).toContain("Crew work has no tasks yet");
  });

  it("does not put packetKey in the primary saved-work summary string", () => {
    expect(scopeEditorSource).toContain("Saved work ·");
    expect(scopeEditorSource).not.toMatch(/\$\{parent\.displayName\} \(\$\{parent\.packetKey\}\)/);
  });

  it("puts add custom work ahead of the reuse dropdown in the create branch", () => {
    expect(scopeEditorSource).not.toContain("— Choose field work on this quote —");
    expect(scopeEditorSource).toContain("Choose existing custom work…");
    expect(scopeEditorSource).toContain("Use existing custom work instead");
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
      createBranchSlice.indexOf("Choose existing custom work…"),
    );
  });
});
