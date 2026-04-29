import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)));
const src = readFileSync(path.join(root, "quote-workspace-line-create-form.tsx"), "utf8");

describe("quote-workspace-line-create-form (static wiring)", () => {
  it("posts to line-items with credentials and JSON", () => {
    expect(src).toContain("/line-items");
    expect(src).toContain('method: "POST"');
    expect(src).toContain('credentials: "include"');
    expect(src).toContain("JSON.stringify(body)");
  });

  it("uses SOLD_SCOPE body from buildSoldScopeLineItemCreateRequestBody", () => {
    expect(src).toContain("buildSoldScopeLineItemCreateRequestBody");
    expect(src).not.toMatch(/MANIFEST/i);
  });

  it("refreshes router after successful create", () => {
    expect(src).toContain("router.refresh()");
  });

  it("exposes add affordance, unit price, line total helper, and contractor copy", () => {
    expect(src).toContain("+ Add line item");
    expect(src).toContain("Add line item");
    expect(src).toContain("Add line");
    expect(src).toContain("Unit price");
    expect(src).toContain("Line total");
    expect(src).toContain("No amount set");
    expect(src).toContain("Estimate-only line");
    expect(src).toContain("Crew tasks and saved work are added from");
    expect(src).toContain("step 1");
    expect(src).toContain("Focused Line &amp; tasks view");
  });

  it("does not surface cents vocabulary in visible labels", () => {
    expect(src).not.toMatch(/>\s*[^<]*[Uu]nit price[^<]*cents/i);
    expect(src).not.toMatch(/Line total[^<]*\(cents\)/i);
  });

  it("hides entire form when canAddLineItems is false", () => {
    expect(src).toMatch(/if\s*\(!canAddLineItems\)[\s\S]*return null/);
  });
});
