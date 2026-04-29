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

  it("frames crew work without packet-admin vocabulary", () => {
    expect(blob).toContain("Crew tasks");
    expect(blob).not.toMatch(/Task Packet/i);
    expect(blobSurface).not.toMatch(/quote-local/i);
    expect(blobSurface).not.toMatch(/field work on this quote/i);
    expect(blob).not.toMatch(/promote/i);
    expect(blob).not.toMatch(/packetKey/i);
    expect(blobSurface).not.toMatch(/revisionId/i);
  });

  it("links to advanced scope route", () => {
    expect(simple).toContain("/scope");
    expect(simple).toContain("Line &amp; tasks");
    expect(simple).toContain("QuoteWorkspaceLineCreateForm");
    expect(simple).toContain("Add quote lines here");
    expect(simple).toContain("Not required for a basic quote line");
    expect(createForm).toContain("+ Add line item");
  });

  it("line card keeps Edit line in workspace and adds optional Line & tasks handoff for estimate-only lines", () => {
    const line = read("quote-workspace-line-card.tsx");
    expect(line).toContain("Edit line");
    expect(line).toContain('type="button"');
    expect(line).toContain("Add crew tasks");
    expect(line).toMatch(/\/quotes\/\$\{quoteId\}\/scope#line-item-\$\{line\.id\}/);
  });

  it("line edit form links quiet Advanced setup to scope line anchor", () => {
    const form = read("quote-workspace-line-edit-form.tsx");
    expect(form).toContain("Advanced setup");
    expect(form).toMatch(/\/quotes\/\$\{quoteId\}\/scope#line-item-/);
  });
});
