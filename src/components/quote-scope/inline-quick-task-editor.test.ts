import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const quickPath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "inline-quick-task-editor.tsx",
);
const scopePath = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "app",
  "(office)",
  "quotes",
  "[quoteId]",
  "scope",
  "scope-editor.tsx",
);

describe("InlineQuickTaskEditor (static)", () => {
  const quick = readFileSync(quickPath, "utf8");

  it("uses standard quote-local item API paths only", () => {
    expect(quick).toContain("/items");
    expect(quick).toContain('method: "POST"');
    expect(quick).toContain('method: "PATCH"');
    expect(quick).toContain('method: "DELETE"');
    expect(quick).not.toContain("/promote");
    expect(quick).not.toContain("handleUpdatePacket");
    expect(quick).not.toContain("handleDeletePacket");
  });

  it("reuses authoring helpers for payloads", () => {
    expect(quick).toContain("draftToBody");
    expect(quick).toContain("itemToDraft");
    expect(quick).toContain("lineKeysForPacketCollision");
  });

  it("scope workspace mounts quick editor instead of single packet editor", () => {
    const scope = readFileSync(scopePath, "utf8");
    expect(scope).toContain("InlineQuickTaskEditor");
    expect(scope).not.toContain("QuoteLocalSinglePacketEditor");
  });

  it("surfaces crew-task primary actions, not packet-admin phrasing", () => {
    expect(quick).toContain("+ Add task");
    expect(quick).toContain("+ From catalog");
    expect(quick).not.toMatch(/Task Packet/i);
  });
});
