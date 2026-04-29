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
  it("LineItemRow exposes stable #line-item-{id} anchor for workspace deep links", () => {
    expect(scopeEditor).toMatch(/id=\{`line-item-\$\{item\.id\}`\}/);
    expect(scopeEditor).toContain("scroll-mt-24");
  });

  it("PacketRow defaults stable field-work anchor id when rowDomId omitted", () => {
    expect(packetEditor).toMatch(/rowDomId \?\? `field-work-\$\{packet\.id\}`/);
    expect(packetEditor).toMatch(/id=\{rowId\}/);
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

  it("shows Edit tasks and Add crew tasks labels for local crew work", () => {
    expect(scopeEditor).toContain("Edit tasks");
    expect(scopeEditor).toContain("Add crew tasks");
    expect(scopeEditor).toContain("Review tasks");
    expect(scopeEditor).toContain("Open saved work");
    expect(scopeEditor).toContain("Set up crew work");
  });

  it("single default Main group uses muted header branch", () => {
    expect(scopeEditor).toContain("singleDefaultMainGroup");
    expect(scopeEditor).toContain('proposalGroups[0]?.name?.trim() === "Main"');
  });

  it("post-save scroll helper does not use window.location.assign (no auto-leave embedded workspace)", () => {
    const fnStart = scopeEditor.indexOf("function scrollFieldWorkSectionIntoView");
    expect(fnStart).toBeGreaterThanOrEqual(0);
    const fnEnd = scopeEditor.indexOf("type ProposalGroup", fnStart);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const fnSrc = scopeEditor.slice(fnStart, fnEnd);
    expect(fnSrc).not.toContain("window.location.assign");
    expect(fnSrc).toContain("if (fieldWorkExternalBaseHref)");
    expect(fnSrc).toContain("scrollIntoView");
  });

  it("explicit link href builders still prefix external base for #quote-local-field-work and #field-work-*", () => {
    const sectionStart = scopeEditor.indexOf("function fieldWorkSectionHref");
    expect(sectionStart).toBeGreaterThanOrEqual(0);
    const sectionEnd = scopeEditor.indexOf("function fieldWorkPacketHref", sectionStart);
    expect(sectionEnd).toBeGreaterThan(sectionStart);
    expect(scopeEditor.slice(sectionStart, sectionEnd)).toContain(
      "return `${fieldWorkExternalBaseHref}#${FIELD_WORK_SECTION_ID}`;",
    );

    const packetStart = scopeEditor.indexOf("function fieldWorkPacketHref");
    expect(packetStart).toBeGreaterThanOrEqual(0);
    const packetEnd = scopeEditor.indexOf("function scrollFieldWorkSectionIntoView", packetStart);
    expect(packetEnd).toBeGreaterThan(packetStart);
    expect(scopeEditor.slice(packetStart, packetEnd)).toContain(
      "return `${fieldWorkExternalBaseHref}#field-work-${packetId}`;",
    );
  });
});
