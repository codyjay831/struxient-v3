import { describe, expect, it } from "vitest";
import { humanizeWorkflowNodeId } from "./workflow-node-display";

describe("humanizeWorkflowNodeId", () => {
  it("converts kebab-case ids to sentence case", () => {
    expect(humanizeWorkflowNodeId("install-rooftop-unit")).toBe("Install rooftop unit");
    expect(humanizeWorkflowNodeId("payment-collection")).toBe("Payment collection");
  });

  it("converts snake_case ids to sentence case", () => {
    expect(humanizeWorkflowNodeId("inspect_attic")).toBe("Inspect attic");
    expect(humanizeWorkflowNodeId("INSPECT_ATTIC")).toBe("Inspect attic");
  });

  it("preserves digits and word boundaries", () => {
    expect(humanizeWorkflowNodeId("node-1")).toBe("Node 1");
    expect(humanizeWorkflowNodeId("step-2-final")).toBe("Step 2 final");
  });

  it("collapses repeated and mixed separators", () => {
    expect(humanizeWorkflowNodeId("foo--bar__baz")).toBe("Foo bar baz");
    expect(humanizeWorkflowNodeId("foo_-_bar")).toBe("Foo bar");
  });

  it("trims surrounding whitespace", () => {
    expect(humanizeWorkflowNodeId("  trim-me  ")).toBe("Trim me");
  });

  it("is idempotent on already human-readable labels", () => {
    expect(humanizeWorkflowNodeId("Already Cased")).toBe("Already Cased");
    expect(humanizeWorkflowNodeId("Install Rooftop Unit")).toBe("Install Rooftop Unit");
  });

  it("returns empty string for empty / whitespace-only input", () => {
    expect(humanizeWorkflowNodeId("")).toBe("");
    expect(humanizeWorkflowNodeId("   ")).toBe("");
  });

  it("handles a single-word lowercase id", () => {
    expect(humanizeWorkflowNodeId("cleanup")).toBe("Cleanup");
  });

  it("handles a single-word uppercase id", () => {
    expect(humanizeWorkflowNodeId("CLEANUP")).toBe("Cleanup");
  });

  it("does not collapse two visibly distinct ids onto the same label", () => {
    const a = humanizeWorkflowNodeId("install-roof");
    const b = humanizeWorkflowNodeId("install-attic");
    expect(a).not.toBe(b);
  });
});
