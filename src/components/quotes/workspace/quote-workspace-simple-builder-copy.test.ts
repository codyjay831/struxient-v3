import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const read = (name: string) => readFileSync(path.join(root, name), "utf8");

/** Drop imports, import continuations, and internal API paths — those may contain `quote-local`; UI copy must not. */
function surfaceCopyOnly(src: string): string {
  return src
    .split(/\r?\n/)
    .filter((l) => {
      if (/^\s*import\s/.test(l)) return false;
      if (/^\s*\}\s*from\s+["']/.test(l)) return false;
      if (l.includes("/api/quote-local-packets")) return false;
      if (l.includes("quote-local-packet")) return false;
      if (l.includes("scopePacketRevisionId")) return false;
      return true;
    })
    .join("\n");
}

describe("quote-workspace-simple-builder shell copy (static)", () => {
  const simple = read("quote-workspace-simple-builder.tsx");
  const createForm = read("quote-workspace-line-create-form.tsx");
  const line = read("quote-workspace-line-card.tsx");
  const crew = read("quote-workspace-crew-tasks-section.tsx");
  const blob = `${simple}\n${line}\n${crew}`;
  const blobSurface = `${surfaceCopyOnly(simple)}\n${surfaceCopyOnly(line)}\n${surfaceCopyOnly(crew)}`;
  const simpleLineSurface = `${surfaceCopyOnly(simple)}\n${surfaceCopyOnly(line)}`;

  it("frames crew work without packet-admin vocabulary", () => {
    expect(blob).toContain("Crew work");
    expect(blob).not.toMatch(/Task Packet/i);
    // `quote-workspace-crew-tasks-section` links to `#quote-local-field-work` (stable DOM id); keep UI copy clean in simple + line only.
    expect(simpleLineSurface).not.toMatch(/quote-local/i);
    expect(blobSurface).not.toMatch(/field work on this quote/i);
    expect(blob).not.toMatch(/promote/i);
    expect(blob).not.toMatch(/packetKey/i);
    expect(blobSurface).not.toMatch(/revisionId/i);
  });

  it("keeps optional focused /scope link and points primary copy at quote workspace step 1", () => {
    expect(simple).toContain("/scope");
    expect(simple).toContain("focused Line &amp; tasks view");
    expect(simple).toContain("#step-1");
    expect(simple).toContain("QuoteWorkspaceLineCreateForm");
    expect(simple).toContain("Add quote lines here");
    expect(createForm).toContain("+ Add line item");
  });

  it("line card keeps Edit line in workspace and same-page line anchor for estimate-only crew setup", () => {
    const line = read("quote-workspace-line-card.tsx");
    expect(line).toContain("Edit line");
    expect(line).toContain('type="button"');
    expect(line).toContain("Add crew tasks");
    expect(line).toMatch(/\/quotes\/\$\{quoteId\}#line-item-\$\{line\.id\}/);
  });

  it("line edit form links quiet Advanced setup to same-page line anchor", () => {
    const form = read("quote-workspace-line-edit-form.tsx");
    expect(form).toContain("Advanced setup");
    expect(form).toMatch(/\/quotes\/\$\{quoteId\}#line-item-/);
  });
});
