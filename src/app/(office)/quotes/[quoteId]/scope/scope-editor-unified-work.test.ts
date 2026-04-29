import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scopeEditorPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "scope-editor.tsx");
const src = readFileSync(scopeEditorPath, "utf8");

describe("scope-editor unified crew work section (static)", () => {
  it("uses one workspace work shell with Crew work heading and internal-tasks helper", () => {
    expect(src).toContain(">Crew work<");
    expect(src).toContain("Internal tasks your team will perform after the quote is approved.");
    expect(src).toContain("showWorkspaceUnifiedWork");
  });

  it("suppresses duplicate read-only preview when inline local editor is shown", () => {
    expect(src).toContain("suppressDuplicateLocalPreview");
    expect(src).toContain("showInlinePacketEditor && executionPreview?.kind === \"manifestLocal\"");
  });

  it("passes workspaceUnified presentation to the preview block inside the shell", () => {
    expect(src).toContain('presentation="workspaceUnified"');
  });

  it("does not use Custom work for this line as the unified primary heading", () => {
    const start = src.indexOf("showWorkspaceUnifiedWork ? (");
    const end = src.indexOf(") : executionPreview != null || (inlineLocalTaskEditing", start);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(end).toBeGreaterThan(start);
    expect(src.slice(start, end)).not.toContain("Custom work for this line");
  });

  it("threads unifiedWorkSection into the single-packet editor for lighter chrome", () => {
    expect(src).toContain("unifiedWorkSection={workspaceCrewTaskCopy}");
  });

  it("does not use standalone Work after approval as primary visible copy", () => {
    expect(src).not.toMatch(/>\s*Work after approval\s*</);
  });
});
